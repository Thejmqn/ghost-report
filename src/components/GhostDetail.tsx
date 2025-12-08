import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { ArrowLeft, Eye, Ghost as GhostIcon, MessageSquare, Send, MapPin, Calendar } from 'lucide-react';
import { User, GhostSighting } from '../types';

interface Ghost {
  id: number;
  type: string;
  name: string;
  description: string;
  visibility: number;
}

interface GhostComment {
  userID: string;
  ghostID: string;
  reportTime: string;
  description: string;
  username: string;
}

interface GhostDetailProps {
  ghost: Ghost;
  user: User;
  onBack: () => void;
  onSelectSighting: (sighting: GhostSighting) => void;
}

export function GhostDetail({ ghost, user, onBack, onSelectSighting }: GhostDetailProps) {
  const [comments, setComments] = useState<GhostComment[]>([]);
  const [sightings, setSightings] = useState<GhostSighting[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(true);
  const [loadingSightings, setLoadingSightings] = useState(true);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Ghost Buster state
  const [isGhostBuster, setIsGhostBuster] = useState(false);
  const [ghostsBusted, setGhostsBusted] = useState(0);
  const [isFighting, setIsFighting] = useState(false);
  const [loadingGhostBuster, setLoadingGhostBuster] = useState(true);
  const [actionInProgress, setActionInProgress] = useState(false);

  useEffect(() => {
    fetchComments();
    fetchSightings();
    fetchGhostBusterStatus();
  }, [ghost.id]);

  const fetchGhostBusterStatus = async () => {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8100';
    setLoadingGhostBuster(true);
    
    try {
      // Check if user is a ghost buster
      const gbResp = await fetch(`${apiBase}/api/users/${user.id}/ghost-buster`);
      if (gbResp.ok) {
        const gbData = await gbResp.json();
        setIsGhostBuster(gbData.isGhostBuster);
        setGhostsBusted(gbData.ghosts_busted || 0);
        
        // Check if currently fighting this ghost
        const fightsResp = await fetch(`${apiBase}/api/users/${user.id}/fights`);
        if (fightsResp.ok) {
          const fightsData = await fightsResp.json();
          const fightingGhosts = fightsData.fighting || [];
          setIsFighting(fightingGhosts.includes(ghost.id));
        }
      } else {
        setIsGhostBuster(false);
      }
    } catch (err) {
      console.error('Error fetching ghost buster status:', err);
    } finally {
      setLoadingGhostBuster(false);
    }
  };

  const fetchComments = async () => {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8100';
    setLoadingComments(true);
    setError(null);
    
    try {
      const resp = await fetch(`${apiBase}/api/ghosts/${ghost.id}/comments`);
      if (!resp.ok) {
        throw new Error(`Failed to load comments: ${resp.status}`);
      }
      const data = await resp.json();
      setComments(data || []);
    } catch (err) {
      console.error('Error fetching comments:', err);
      setError(err instanceof Error ? err.message : 'Failed to load comments');
    } finally {
      setLoadingComments(false);
    }
  };

  const fetchSightings = async () => {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8100';
    setLoadingSightings(true);
    
    try {
      const resp = await fetch(`${apiBase}/api/ghosts/${ghost.id}/sightings`);
      if (!resp.ok) {
        throw new Error(`Failed to load sightings: ${resp.status}`);
      }
      const data = await resp.json();
      
      // Parse the sightings data
      const parsed: GhostSighting[] = (data || []).map((d: any) => ({
        id: String(d.id),
        visibility: Number(d.visibility || 0),
        time: d.time ? new Date(d.time) : new Date(),
        userReportID: String(d.userReportID || ''),
        latitude: (d.latitude !== undefined && d.latitude !== null) ? Number(d.latitude) : null,
        longitude: (d.longitude !== undefined && d.longitude !== null) ? Number(d.longitude) : null,
        description: d.description || '',
        ghostName: d.ghostName || ghost.name
      }));
      
      setSightings(parsed);
    } catch (err) {
      console.error('Error fetching sightings:', err);
      // Don't set error state for sightings, just log it
    } finally {
      setLoadingSightings(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8100';
    setSubmittingComment(true);
    setError(null);

    try {
      const resp = await fetch(`${apiBase}/api/ghosts/${ghost.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userID: user.id,
          description: newComment.trim()
        })
      });

      if (!resp.ok) {
        throw new Error(`Failed to post comment: ${resp.status}`);
      }

      setNewComment('');
      await fetchComments();
    } catch (err) {
      console.error('Error posting comment:', err);
      setError(err instanceof Error ? err.message : 'Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleStartFight = async () => {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8100';
    setActionInProgress(true);
    
    try {
      const resp = await fetch(`${apiBase}/api/users/${user.id}/fights/${ghost.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fighting: true })
      });
      
      if (resp.ok) {
        setIsFighting(true);
      } else {
        setError('Failed to start fight');
      }
    } catch (err) {
      console.error('Error starting fight:', err);
      setError(err instanceof Error ? err.message : 'Failed to start fight');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleCancelFight = async () => {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8100';
    setActionInProgress(true);
    
    try {
      const resp = await fetch(`${apiBase}/api/users/${user.id}/fights/${ghost.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fighting: false })
      });
      
      if (resp.ok) {
        setIsFighting(false);
      } else {
        setError('Failed to cancel fight');
      }
    } catch (err) {
      console.error('Error canceling fight:', err);
      setError(err instanceof Error ? err.message : 'Failed to cancel fight');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleBustGhost = async () => {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8100';
    setActionInProgress(true);
    
    try {
      // First, cancel the fight
      await fetch(`${apiBase}/api/users/${user.id}/fights/${ghost.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fighting: false })
      });
      
      // Then increment ghosts_busted
      const resp = await fetch(`${apiBase}/api/users/${user.id}/ghost-buster/bust`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (resp.ok) {
        const data = await resp.json();
        setIsFighting(false);
        setGhostsBusted(data.ghosts_busted);
        setError(null);
        // Show success message
        alert(`🎉 Ghost BUSTED! Total ghosts busted: ${data.ghosts_busted}`);
      } else {
        setError('Failed to bust ghost');
      }
    } catch (err) {
      console.error('Error busting ghost:', err);
      setError(err instanceof Error ? err.message : 'Failed to bust ghost');
    } finally {
      setActionInProgress(false);
    }
  };

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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const formatSightingDate = (date: Date) => {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <Button
        variant="ghost"
        onClick={onBack}
        className="mb-4 flex items-center space-x-2"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Ghosts</span>
      </Button>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <CardTitle className="text-2xl flex items-center space-x-3">
              <GhostIcon className="w-7 h-7" />
              <span>{ghost.name}</span>
            </CardTitle>
            <Badge className={getVisibilityColor(ghost.visibility)}>
              <Eye className="w-4 h-4 mr-1" />
              {getVisibilityLabel(ghost.visibility)}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Type</p>
            <p className="text-lg font-medium">{ghost.type}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-1">Description</p>
            <p className="text-foreground leading-relaxed">
              {ghost.description || 'No description available.'}
            </p>
          </div>

          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground">
              Visibility Rating: {ghost.visibility}/10
            </p>
          </div>

          {/* Ghost Buster Actions */}
          {isGhostBuster && !loadingGhostBuster && (
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Ghost Buster Actions</h3>
                <Badge variant="secondary">
                  {ghostsBusted} Ghosts Busted
                </Badge>
              </div>
              
              {isFighting ? (
                <div className="space-y-3">
                  <div className="p-3 bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300 rounded-md">
                    <p className="font-medium">⚔️ Currently Fighting This Ghost</p>
                    <p className="text-sm mt-1">Time to finish the job!</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleBustGhost}
                      disabled={actionInProgress}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      {actionInProgress ? 'Busting...' : '👻 BUST THIS GHOST!'}
                    </Button>
                    <Button
                      onClick={handleCancelFight}
                      disabled={actionInProgress}
                      variant="outline"
                    >
                      {actionInProgress ? 'Canceling...' : 'Cancel Fight'}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  onClick={handleStartFight}
                  disabled={actionInProgress}
                  className="w-full"
                  variant="default"
                >
                  {actionInProgress ? 'Starting Fight...' : '⚔️ Start Fighting This Ghost'}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Eye className="w-5 h-5" />
            <span>Sightings ({sightings.length})</span>
          </CardTitle>
        </CardHeader>

        <CardContent>
          {loadingSightings ? (
            <p className="text-center text-muted-foreground py-4">Loading sightings...</p>
          ) : sightings.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No sightings recorded for this ghost yet.
            </p>
          ) : (
            <div className="space-y-3">
              {sightings.map((sighting) => (
                <Card 
                  key={sighting.id} 
                  className="bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                  onClick={() => onSelectSighting(sighting)}
                >
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {formatSightingDate(sighting.time)}
                        </span>
                      </div>
                      <Badge className={getVisibilityColor(sighting.visibility)}>
                        {getVisibilityLabel(sighting.visibility)}
                      </Badge>
                    </div>
                    
                    {(sighting.latitude !== null && sighting.latitude !== undefined && 
                      sighting.longitude !== null && sighting.longitude !== undefined) && (
                      <div className="flex items-center space-x-2 mb-2 text-sm text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        <span>
                          {sighting.latitude.toFixed(4)}, {sighting.longitude.toFixed(4)}
                        </span>
                      </div>
                    )}
                    
                    <p className="text-foreground leading-relaxed line-clamp-2">
                      {sighting.description}
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
            <MessageSquare className="w-5 h-5" />
            <span>Comments ({comments.length})</span>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-md text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmitComment} className="space-y-3">
            <Textarea
              placeholder="Share your thoughts about this ghost..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <Button
              type="submit"
              disabled={submittingComment || !newComment.trim()}
              className="flex items-center space-x-2"
            >
              <Send className="w-4 h-4" />
              <span>{submittingComment ? 'Posting...' : 'Post Comment'}</span>
            </Button>
          </form>

          <div className="space-y-3 pt-4 border-t">
            {loadingComments ? (
              <p className="text-center text-muted-foreground py-4">Loading comments...</p>
            ) : comments.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                No comments yet. Be the first to share your thoughts!
              </p>
            ) : (
              comments.map((comment, index) => (
                <Card key={`${comment.userID}-${comment.ghostID}-${index}`} className="bg-muted/50">
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium">{comment.username}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(comment.reportTime)}
                      </span>
                    </div>
                    <p className="text-foreground leading-relaxed">{comment.description}</p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}