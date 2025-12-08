import { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { GhostSighting, User } from '../types';
import { MapPin, Clock, Eye, User as UserIcon, ArrowLeft, MessageSquare } from 'lucide-react';

declare global {
  interface Window {
    google: any;
  }
}

interface SightingComment {
  userID: string;
  sightingID: string;
  reportTime: Date;
  description: string;
  username?: string;
}

interface SightingDetailProps {
  sighting: GhostSighting;
  user: User;
  onBack: () => void;
}

export function SightingDetail({ sighting, user, onBack }: SightingDetailProps) {
  const [comments, setComments] = useState<SightingComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(true);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [ghostName, setGhostName] = useState<string>((sighting as any).ghostName || 'Unknown Ghost');
  const [newGhostName, setNewGhostName] = useState<string>('');
  const [updatingGhost, setUpdatingGhost] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);

  // Load Google Maps script
  useEffect(() => {
    const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    
    if (!GOOGLE_MAPS_API_KEY) {
      console.error('Google Maps API key not found. Please set VITE_GOOGLE_MAPS_API_KEY in your .env file');
      return;
    }
    
    if (window.google && window.google.maps) {
      setMapsLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`;
    script.async = true;
    script.defer = true;
    script.onload = () => setMapsLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Initialize map when loaded and coordinates are available
  useEffect(() => {
    if (!mapsLoaded || !mapRef.current) return;
    if (sighting.latitude === null || sighting.longitude === null) return;

    const position = { lat: sighting.latitude, lng: sighting.longitude };

    if (!mapInstanceRef.current) {
      // Small delay to ensure the container is fully rendered
      setTimeout(() => {
        if (!mapRef.current) return;
        
        mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
          center: position,
          zoom: 15,
          mapTypeId: 'roadmap'
        });

        new window.google.maps.Marker({
          position: position,
          map: mapInstanceRef.current,
          title: 'Sighting Location'
        });
      }, 100);
    }
  }, [mapsLoaded, sighting.latitude, sighting.longitude]);

  useEffect(() => {
    fetchComments();
  }, [sighting.id]);

  const fetchComments = async () => {
    try {
      setLoadingComments(true);
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8100';
      const resp = await fetch(`${apiBase}/api/sightings/${sighting.id}/comments`);
      
      if (resp.ok) {
        const data = await resp.json();
        const transformedComments = data.map((c: any) => ({
          userID: String(c.userID),
          sightingID: String(c.sightingID),
          reportTime: new Date(c.reportTime),
          description: c.description || '',
          username: c.username || `User ${c.userID}`
        }));
        setComments(transformedComments);
      }
    } catch (err) {
      console.error('Error fetching comments:', err);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmittingComment(true);
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8100';
      const resp = await fetch(`${apiBase}/api/sightings/${sighting.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userID: user.id,
          description: newComment
        })
      });

      if (resp.status === 201) {
        setNewComment('');
        await fetchComments();
      } else {
        const err = await resp.json().catch(() => ({}));
        console.error('Error posting comment:', err);
      }
    } catch (err) {
      console.error('Error submitting comment:', err);
    } finally {
      setSubmittingComment(false);
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

  const hasValidCoordinates = sighting.latitude !== null && sighting.longitude !== null;

  return (
    <div className="max-w-4xl mx-auto p-4">
      <Button 
        variant="ghost" 
        onClick={onBack}
        className="mb-4"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Sightings
      </Button>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <CardTitle className="text-2xl">
              {ghostName}
            </CardTitle>
            <Badge className={getVisibilityColor(sighting.visibility)}>
              <Eye className="w-3 h-3 mr-1" />
              {getVisibilityLabel(sighting.visibility)}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex items-center space-x-2 text-muted-foreground">
              <MapPin className="w-4 h-4" />
              <span>
                {hasValidCoordinates
                  ? `${sighting.latitude}, ${sighting.longitude}` 
                  : 'Unknown location'}
              </span>
            </div>
            <div className="flex items-center space-x-2 text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>{sighting.time ? new Date(sighting.time).toLocaleString() : 'Unknown time'}</span>
            </div>
            <div className="flex items-center space-x-2 text-muted-foreground">
              <UserIcon className="w-4 h-4" />
              <span>Reported by User #{sighting.userReportID}</span>
            </div>
          </div>

          {/* Map Display */}
          {hasValidCoordinates && (
            <div className="pt-4 border-t">
              <h3 className="font-semibold mb-2">Location</h3>
              <div 
                ref={mapRef} 
                className="w-full h-64 rounded-lg border border-border"
                style={{ minHeight: '256px' }}
              />
            </div>
          )}

          <div className="pt-4 border-t">
            <h3 className="font-semibold mb-2">Description</h3>
            <p className="text-foreground leading-relaxed whitespace-pre-wrap">
              {sighting.description}
            </p>
            <div className="mt-4">
              <label className="block text-sm font-medium text-muted-foreground mb-1">New Ghost Name</label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={newGhostName}
                  onChange={(e) => setNewGhostName(e.target.value)}
                  placeholder="Enter new ghost name"
                  className="input input-bordered flex-1 p-2 rounded border bg-background text-foreground"
                  disabled={updatingGhost}
                />
                <Button
                  onClick={async () => {
                    if (!newGhostName.trim()) return;
                    setUpdatingGhost(true);
                    try {
                      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8100';
                      const resp = await fetch(`${apiBase}/api/sightings/${sighting.id}/ghost-name`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ newName: newGhostName })
                      });
                      if (resp.ok) {
                        setGhostName(newGhostName);
                        setNewGhostName('');
                      } else {
                        const err = await resp.json().catch(() => ({}));
                        console.error('Failed updating ghost name:', err);
                      }
                    } catch (err) {
                      console.error('Error updating ghost name:', err);
                    } finally {
                      setUpdatingGhost(false);
                    }
                  }}
                  disabled={updatingGhost || !newGhostName.trim()}
                >
                  {updatingGhost ? 'Updating...' : 'Update Ghost'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MessageSquare className="w-5 h-5" />
            <span>Comments ({comments.length})</span>
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <form onSubmit={handleSubmitComment} className="space-y-3">
            <Textarea
              placeholder="Add your comment or observations..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="min-h-24"
              disabled={submittingComment}
            />
            <Button 
              type="submit" 
              disabled={submittingComment || !newComment.trim()}
            >
              {submittingComment ? 'Posting...' : 'Post Comment'}
            </Button>
          </form>

          <div className="space-y-4 pt-4 border-t">
            {loadingComments ? (
              <p className="text-center text-muted-foreground py-8">Loading comments...</p>
            ) : comments.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No comments yet. Be the first to comment!
              </p>
            ) : (
              comments.map((comment, index) => (
                <div 
                  key={`${comment.userID}-${comment.sightingID}-${index}`}
                  className="bg-muted/50 rounded-lg p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <UserIcon className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{comment.username}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {comment.reportTime.toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {comment.description}
                  </p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}