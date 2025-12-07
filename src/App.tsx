import { useState, useEffect } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { Navigation } from './components/Navigation';
import { ReportGhost } from './components/ReportGhost';
import { BrowseGhosts } from './components/BrowseGhosts';
import { UserProfile } from './components/UserProfile';
import { SightingDetail } from './components/SightingDetail';
import { User, GhostSighting, Screen } from './types';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [currentScreen, setCurrentScreen] = useState<Screen>('report');
  const [selectedSighting, setSelectedSighting] = useState<GhostSighting | null>(null);
  const [ghostSightings, setGhostSightingsState] = useState<GhostSighting[]>([]);
  const [loadingSightings, setLoadingSightings] = useState(false);
  const [errorLoadingSightings, setErrorLoadingSightings] = useState<string | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Check for stored user session on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('ghostapp_user');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
      } catch (err) {
        console.error('Error parsing stored user:', err);
        localStorage.removeItem('ghostapp_user');
      }
    }
    setIsCheckingAuth(false);
  }, []);

  // Fetch sightings when component mounts
  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8100';
    const fetchSightings = async () => {
      setLoadingSightings(true);
      setErrorLoadingSightings(null);
      try {
        const resp = await fetch(`${apiBase}/api/sightings`);
        if (!resp.ok) {
          throw new Error(`Failed to load sightings: ${resp.status}`);
        }
        const data = await resp.json();
        
        console.log('Raw API response:', data);
        
        // Ensure timestamps are Date objects
        const parsed: GhostSighting[] = (data || []).map((d: any) => {
          const sighting = {
            id: String(d.id),
            visibility: Number(d.visibility || 0),
            time: d.time ? new Date(d.time) : new Date(),
            userReportID: String(d.userReportID || ''),
            latitude: (d.latitude !== undefined && d.latitude !== null) ? Number(d.latitude) : null,
            longitude: (d.longitude !== undefined && d.longitude !== null) ? Number(d.longitude) : null,
            description: d.description || '',
            ghostName: d.ghostName || 'Unknown'
          } as GhostSighting;
          return sighting;
        });
        
        console.log('Parsed sightings:', parsed);
        console.log('Number of sightings:', parsed.length);
        
        setGhostSightingsState(parsed);
      } catch (err) {
        console.error('Error fetching sightings:', err);
        setErrorLoadingSightings(err instanceof Error ? err.message : 'Failed to load sightings');
      } finally {
        setLoadingSightings(false);
      }
    };

    fetchSightings();
  }, []);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    // Store user in localStorage
    localStorage.setItem('ghostapp_user', JSON.stringify(loggedInUser));
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentScreen('report');
    // Remove user from localStorage
    localStorage.removeItem('ghostapp_user');
  };

  const handleSubmitSighting = (sightingData: GhostSighting) => {
    // Accept a full GhostSighting (from backend) and prepend to list
    console.log('Adding new sighting:', sightingData);
    setGhostSightingsState(prev => [sightingData, ...prev]);
  };

  const handleUpdateSighting = (id: string, updatedData: Partial<GhostSighting>) => {
    console.log('Updating sighting:', id, updatedData);
    setGhostSightingsState(prev => 
      prev.map(sighting => 
        sighting.id === id 
          ? { ...sighting, ...updatedData }
          : sighting
      )
    );
  };

  const handleDeleteSighting = (id: string) => {
    console.log('Deleting sighting:', id);
    setGhostSightingsState(prev => prev.filter(sighting => sighting.id !== id));
  };

  const handleSelectSighting = (sighting: GhostSighting) => {
    setSelectedSighting(sighting);
  };

  const handleBackFromDetail = () => {
    setSelectedSighting(null);
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const userSightings = ghostSightings.filter(sighting => sighting.userReportID === user.id);

  const renderCurrentScreen = () => {
    // If viewing a sighting detail, show that instead
    if (selectedSighting) {
      return (
        <SightingDetail 
          sighting={selectedSighting} 
          user={user}
          onBack={handleBackFromDetail}
        />
      );
    }

    switch (currentScreen) {
      case 'report':
        return <ReportGhost user={user} onSubmitSighting={handleSubmitSighting} />;
      case 'browse':
        if (loadingSightings) {
          return (
            <div className="max-w-4xl mx-auto p-4">
              <div className="text-center py-12">
                <p>Loading ghost sightings...</p>
              </div>
            </div>
          );
        }
        if (errorLoadingSightings) {
          return (
            <div className="max-w-4xl mx-auto p-4">
              <div className="text-center py-12 text-red-600">
                <p>Error: {errorLoadingSightings}</p>
                <button 
                  onClick={() => window.location.reload()}
                  className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded"
                >
                  Retry
                </button>
              </div>
            </div>
          );
        }
        console.log('Rendering BrowseGhosts with sightings:', ghostSightings);
        return <BrowseGhosts sightings={ghostSightings} onSelectSighting={handleSelectSighting} />;
      case 'profile':
        return (
          <UserProfile
            user={user}
            userSightings={userSightings}
            onUpdateSighting={handleUpdateSighting}
            onDeleteSighting={handleDeleteSighting}
          />
        );
      default:
        return <ReportGhost user={user} onSubmitSighting={handleSubmitSighting} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation
        currentScreen={currentScreen}
        onScreenChange={setCurrentScreen}
        user={user}
        onLogout={handleLogout}
      />
      <main className="py-6">
        {renderCurrentScreen()}
      </main>
    </div>
  );
}