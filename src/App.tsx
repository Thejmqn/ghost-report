import { useState } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { Navigation } from './components/Navigation';
import { ReportGhost } from './components/ReportGhost';
import { BrowseGhosts } from './components/BrowseGhosts';
import { UserProfile } from './components/UserProfile';
import { User, GhostSighting, Screen } from './types';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [currentScreen, setCurrentScreen] = useState<Screen>('report');
  const [ghostSightings, setGhostSightingsState] = useState<GhostSighting[]>([
    // Sample data for demonstration
    {
      id: '1',
      userId: 'sample-user',
      username: 'ghost_hunter_101',
      location: 'Library 3rd Floor - Study Room B',
      description: 'I was studying late when I saw a translucent figure of an elderly woman in Victorian dress walking between the bookshelves. She seemed to be searching for something specific. When I blinked, she was gone.',
      ghostType: 'Victorian Lady',
      timeOfSighting: 'Around 11:45 PM on October 31st',
      visibilityLevel: 'Clear',
      timestamp: new Date('2024-10-31T23:45:00')
    },
    {
      id: '2',
      userId: 'sample-user-2',
      username: 'paranormal_student',
      location: 'Main Hall Basement',
      description: 'Heard footsteps and piano music coming from the old music room that has been locked for years. The temperature dropped significantly as I approached.',
      ghostType: 'Phantom Musician',
      timeOfSighting: 'Tuesday night around 2 AM',
      visibilityLevel: 'Faint',
      timestamp: new Date('2024-11-01T02:00:00')
    }
  ]);

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