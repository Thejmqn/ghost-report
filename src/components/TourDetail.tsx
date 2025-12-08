import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ArrowLeft, Calendar, Clock, MapPin, Users, Eye, Ghost as GhostIcon } from 'lucide-react';
import { User, Tour, Ghost } from '../types';

interface TourDetailProps {
  tour: Tour;
  user: User;
  onBack: () => void;
  onSelectGhost: (ghost: Ghost) => void;
}

export function TourDetail({ tour, user, onBack, onSelectGhost }: TourDetailProps) {
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const [participants, setParticipants] = useState<Array<{ id: string; username: string }>>([]);
  const [loadingGhosts, setLoadingGhosts] = useState(true);
  const [loadingParticipants, setLoadingParticipants] = useState(true);
  const [isSignedUp, setIsSignedUp] = useState(tour.isSignedUp || false);
  const [joiningTour, setJoiningTour] = useState(false);

  useEffect(() => {
    fetchGhosts();
    fetchParticipants();
  }, [tour.id]);

  const fetchGhosts = async () => {
    const apiBase = import.meta.env.VITE_API_URL || 'https://ghost-report-backend.azurewebsites.net';
    setLoadingGhosts(true);

    try {
      const resp = await fetch(`${apiBase}/api/tours/${tour.id}/ghosts`);
      if (!resp.ok) {
        throw new Error(`Failed to load ghosts: ${resp.status}`);
      }
      const data = await resp.json();
      setGhosts(data || []);
    } catch (err) {
      console.error('Error fetching ghosts:', err);
    } finally {
      setLoadingGhosts(false);
    }
  };

  const fetchParticipants = async () => {
    const apiBase = import.meta.env.VITE_API_URL || 'https://ghost-report-backend.azurewebsites.net';
    setLoadingParticipants(true);

    try {
      const resp = await fetch(`${apiBase}/api/tours/${tour.id}/participants`);
      if (!resp.ok) {
        throw new Error(`Failed to load participants: ${resp.status}`);
      }
      const data = await resp.json();
      setParticipants(data || []);
      
      // Check if current user is signed up
      const userSignedUp = (data || []).some((p: any) => String(p.id) === String(user.id));
      setIsSignedUp(userSignedUp);
    } catch (err) {
      console.error('Error fetching participants:', err);
    } finally {
      setLoadingParticipants(false);
    }
  };

  const handleJoinTour = async () => {
    const apiBase = import.meta.env.VITE_API_URL || 'https://ghost-report-backend.azurewebsites.net';
    setJoiningTour(true);

    try {
      const resp = await fetch(`${apiBase}/api/tours/${tour.id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userID: user.id })
      });

      if (!resp.ok) {
        throw new Error(`Failed to join tour: ${resp.status}`);
      }

      await fetchParticipants();
    } catch (err) {
      console.error('Error joining tour:', err);
    } finally {
      setJoiningTour(false);
    }
  };

  const handleLeaveTour = async () => {
    const apiBase = import.meta.env.VITE_API_URL || 'https://ghost-report-backend.azurewebsites.net';
    setJoiningTour(true);

    try {
      const resp = await fetch(`${apiBase}/api/tours/${tour.id}/leave`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userID: user.id })
      });

      if (!resp.ok) {
        throw new Error(`Failed to leave tour: ${resp.status}`);
      }

      await fetchParticipants();
    } catch (err) {
      console.error('Error leaving tour:', err);
    } finally {
      setJoiningTour(false);
    }
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('en-US', {
      month: 'long',
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

  const isPastTour = tour.endTime < new Date();

  const getVisibilityColor = (visibility: number) => {
    if (visibility >= 8) return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    if (visibility >= 5) return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
    return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
  };

  const getVisibilityLabel = (visibility: number) => {
    if (visibility >= 8) return 'Very Clear';
    if (visibility >= 5) return 'Clear';
    return 'Faint';
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <Button
        variant="ghost"
        onClick={onBack}
        className="mb-4 flex items-center space-x-2"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Tours</span>
      </Button>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <CardTitle className="text-2xl">
              Tour by {tour.guide}
            </CardTitle>
            <div className="flex gap-2">
              {isPastTour && <Badge variant="secondary">Past</Badge>}
              {isSignedUp && <Badge className="bg-green-100 text-green-800">You're Signed Up</Badge>}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-start space-x-2">
              <Calendar className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Start Time</p>
                <p className="font-medium">{formatDateTime(tour.startTime)}</p>
              </div>
            </div>
            <div className="flex items-start space-x-2">
              <Clock className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Duration</p>
                <p className="font-medium">{getDuration(tour.startTime, tour.endTime)}</p>
              </div>
            </div>
          </div>

          <div className="flex items-start space-x-2">
            <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-1">Route</p>
              <p className="font-medium">{tour.path}</p>
            </div>
          </div>

          {!isPastTour && (
            <div className="pt-4 border-t">
              {isSignedUp ? (
                <Button
                  variant="outline"
                  onClick={handleLeaveTour}
                  disabled={joiningTour}
                  className="w-full sm:w-auto"
                >
                  {joiningTour ? 'Leaving...' : 'Leave Tour'}
                </Button>
              ) : (
                <Button
                  onClick={handleJoinTour}
                  disabled={joiningTour}
                  className="w-full sm:w-auto"
                >
                  {joiningTour ? 'Joining...' : 'Join Tour'}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <GhostIcon className="w-5 h-5" />
            <span>Ghosts on Tour ({ghosts.length})</span>
          </CardTitle>
        </CardHeader>

        <CardContent>
          {loadingGhosts ? (
            <p className="text-center text-muted-foreground py-4">Loading ghosts...</p>
          ) : ghosts.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No ghosts included in this tour.
            </p>
          ) : (
            <div className="space-y-3">
              {ghosts.map((ghost) => (
                <Card 
                  key={ghost.id} 
                  className="bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                  onClick={() => onSelectGhost(ghost)}
                >
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center space-x-2">
                        <GhostIcon className="w-4 h-4" />
                        <span className="font-medium">{ghost.name}</span>
                      </div>
                      <Badge className={getVisibilityColor(ghost.visibility)}>
                        <Eye className="w-3 h-3 mr-1" />
                        {getVisibilityLabel(ghost.visibility)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">{ghost.type}</p>
                    <p className="text-sm text-foreground leading-relaxed line-clamp-2">
                      {ghost.description}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Click to view details
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="w-5 h-5" />
            <span>Participants ({participants.length})</span>
          </CardTitle>
        </CardHeader>

        <CardContent>
          {loadingParticipants ? (
            <p className="text-center text-muted-foreground py-4">Loading participants...</p>
          ) : participants.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No one has signed up yet. Be the first!
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {participants.map((participant) => (
                <div
                  key={participant.id}
                  className="p-2 bg-muted rounded-md text-sm text-center"
                >
                  {participant.username}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}