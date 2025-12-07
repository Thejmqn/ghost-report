import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Calendar, Clock, MapPin, Users, Plus, Ghost as GhostIcon } from 'lucide-react';
import { User, Tour } from '../types';

interface ToursPageProps {
  user: User;
  onSelectTour: (tour: Tour) => void;
  onCreateTour: () => void;
}

export function ToursPage({ user, onSelectTour, onCreateTour }: ToursPageProps) {
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joiningTour, setJoiningTour] = useState<string | null>(null);

  useEffect(() => {
    fetchTours();
  }, [user.id]);

  const fetchTours = async () => {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8100';
    setLoading(true);
    setError(null);

    try {
      const resp = await fetch(`${apiBase}/api/tours?userId=${user.id}`);
      if (!resp.ok) {
        throw new Error(`Failed to load tours: ${resp.status}`);
      }
      const data = await resp.json();
      
      const parsed: Tour[] = (data || []).map((d: any) => ({
        id: String(d.id),
        startTime: new Date(d.startTime),
        endTime: new Date(d.endTime),
        guide: d.guide || 'Unknown Guide',
        path: d.path || '',
        ghostCount: Number(d.ghostCount || 0),
        signupCount: Number(d.signupCount || 0),
        isSignedUp: Boolean(d.isSignedUp)
      }));

      setTours(parsed);
    } catch (err) {
      console.error('Error fetching tours:', err);
      setError(err instanceof Error ? err.message : 'Failed to load tours');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinTour = async (tourId: string, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8100';
    setJoiningTour(tourId);

    try {
      const resp = await fetch(`${apiBase}/api/tours/${tourId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userID: user.id })
      });

      if (!resp.ok) {
        throw new Error(`Failed to join tour: ${resp.status}`);
      }

      await fetchTours();
    } catch (err) {
      console.error('Error joining tour:', err);
      setError(err instanceof Error ? err.message : 'Failed to join tour');
    } finally {
      setJoiningTour(null);
    }
  };

  const handleLeaveTour = async (tourId: string, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8100';
    setJoiningTour(tourId);

    try {
      const resp = await fetch(`${apiBase}/api/tours/${tourId}/leave`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userID: user.id })
      });

      if (!resp.ok) {
        throw new Error(`Failed to leave tour: ${resp.status}`);
      }

      await fetchTours();
    } catch (err) {
      console.error('Error leaving tour:', err);
      setError(err instanceof Error ? err.message : 'Failed to leave tour');
    } finally {
      setJoiningTour(null);
    }
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const getDuration = (start: Date, end: Date) => {
    const diff = end.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const isPastTour = (endTime: Date) => {
    return endTime < new Date();
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="text-center py-12">
          <p>Loading tours...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="text-center py-12 text-red-600">
          <p>Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl flex items-center space-x-2">
          <MapPin className="w-6 h-6" />
          <span>Ghost Tours</span>
        </h1>
        <Button onClick={onCreateTour} className="flex items-center space-x-2">
          <Plus className="w-4 h-4" />
          <span>Create Tour</span>
        </Button>
      </div>

      {tours.length === 0 ? (
        <Card className="text-center">
          <CardContent className="py-12">
            <h3 className="text-lg mb-2">No Tours Available</h3>
            <p className="text-muted-foreground mb-4">
              Be the first to create a ghost tour!
            </p>
            <Button onClick={onCreateTour}>Create Tour</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {tours.map((tour) => {
            const past = isPastTour(tour.endTime);
            return (
              <Card 
                key={tour.id} 
                className={`hover:shadow-lg transition-shadow cursor-pointer ${past ? 'opacity-60' : ''}`}
                onClick={() => onSelectTour(tour)}
              >
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <CardTitle className="text-lg">
                      Tour by {tour.guide}
                    </CardTitle>
                    <div className="flex gap-2">
                      {past && <Badge variant="secondary">Past</Badge>}
                      {tour.isSignedUp && <Badge className="bg-green-100 text-green-800">Signed Up</Badge>}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex items-center space-x-2 text-sm">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span>{formatDateTime(tour.startTime)}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span>{getDuration(tour.startTime, tour.endTime)}</span>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Route</p>
                    <p className="text-foreground">{tour.path}</p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <GhostIcon className="w-4 h-4" />
                        <span>{tour.ghostCount} ghosts</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Users className="w-4 h-4" />
                        <span>{tour.signupCount} signed up</span>
                      </div>
                    </div>
                    {!past && (
                      tour.isSignedUp ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e: React.MouseEvent<HTMLButtonElement>) => handleLeaveTour(tour.id, e)}
                          disabled={joiningTour === tour.id}
                        >
                          {joiningTour === tour.id ? 'Leaving...' : 'Leave Tour'}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={(e: React.MouseEvent<HTMLButtonElement>) => handleJoinTour(tour.id, e)}
                          disabled={joiningTour === tour.id}
                        >
                          {joiningTour === tour.id ? 'Joining...' : 'Join Tour'}
                        </Button>
                      )
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}