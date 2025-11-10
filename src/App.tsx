import { useState, useEffect } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { Navigation } from './components/Navigation';
import { ReportGhost } from './components/ReportGhost';
import { BrowseGhosts } from './components/BrowseGhosts';
import { UserProfile } from './components/UserProfile';
import { User, GhostSighting, Screen } from './types';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [currentScreen, setCurrentScreen] = useState<Screen>('report');
  const [ghostSightings, setGhostSightingsState] = useState<GhostSighting[]>([]);
  const [loadingSightings, setLoadingSightings] = useState(false);

  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8100';
    const fetchSightings = async () => {
      setLoadingSightings(true);
      try {
        const resp = await fetch(`${apiBase}/api/sightings`);
        if (!resp.ok) throw new Error('Failed to load sightings');
        const data = await resp.json();
        // Ensure timestamps are Date objects
        const parsed: GhostSighting[] = (data || []).map((d: any) => ({
          id: String(d.id),
          userId: String(d.userId || ''),
          username: d.username || 'Unknown',
          location: d.location || 'Unknown',
          description: d.description || '',
          ghostType: d.ghostType || '',
          timeOfSighting: d.timeOfSighting || d.time || '',
          visibilityLevel: d.visibilityLevel || 'Faint',
          timestamp: d.timestamp ? new Date(d.timestamp) : (d.time ? new Date(d.time) : new Date())
        }));
        setGhostSightingsState(parsed);

        console.log("HELLO WORLD TEST");
        console.log(parsed);
      } catch (err) {
        console.error('Error fetching sightings:', err);
      } finally {
        setLoadingSightings(false);
      }
    };

    fetchSightings();
  }, []);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentScreen('report');
  };

  const handleSubmitSighting = (sightingData: Omit<GhostSighting, 'id' | 'timestamp'>) => {
    const newSighting: GhostSighting = {
      ...sightingData,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date()
    };
    
    setGhostSightingsState(prev => [newSighting, ...prev]);
  };

  const handleUpdateSighting = (id: string, updatedData: Partial<GhostSighting>) => {
    setGhostSightingsState(prev => 
      prev.map(sighting => 
        sighting.id === id 
          ? { ...sighting, ...updatedData }
          : sighting
      )
    );
  };

  const handleDeleteSighting = (id: string) => {
    setGhostSightingsState(prev => prev.filter(sighting => sighting.id !== id));
  };

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const userSightings = ghostSightings.filter(sighting => sighting.userId === user.id);

  const renderCurrentScreen = () => {
    switch (currentScreen) {
      case 'report':
        return <ReportGhost user={user} onSubmitSighting={handleSubmitSighting} />;
      case 'browse':
        return <BrowseGhosts sightings={ghostSightings} />;
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