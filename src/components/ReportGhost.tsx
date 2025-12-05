import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { GhostSighting, User } from '../types';
import { MapPin, Clock, Eye } from 'lucide-react';

interface Ghost {
  id: string;
  type: string;
  name: string;
  description: string;
  visibility: number;
}

interface ReportGhostProps {
  user: User;
  onSubmitSighting: (sighting: GhostSighting) => void;
}

export function ReportGhost({ user, onSubmitSighting }: ReportGhostProps) {
  const [formData, setFormData] = useState({
    latitude: '',
    longitude: '',
    description: '',
    ghostID: 'unknown',
    timeOfSighting: '',
    visibilityLevel: '' as 'Faint' | 'Clear' | 'Very Clear' | ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const [loadingGhosts, setLoadingGhosts] = useState(true);

  // Fetch known ghosts from the API
  useEffect(() => {
    const fetchGhosts = async () => {
      try {
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8100';
        const resp = await fetch(`${apiBase}/api/ghosts`);
        if (resp.ok) {
          const data = await resp.json();
          const transformedGhosts = data.map((g: any) => ({
            id: String(g.id),
            type: g.type || '',
            name: g.name || '',
            description: g.description || '',
            visibility: Number(g.visibility || 0)
          }));
          setGhosts(transformedGhosts);
        }
      } catch (err) {
        console.error('Error fetching ghosts:', err);
      } finally {
        setLoadingGhosts(false);
      }
    };

    fetchGhosts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const latitudeVal = formData.latitude ? Number(formData.latitude) : null;
    const longitudeVal = formData.longitude ? Number(formData.longitude) : null;

    // Map visibility level to numeric value
    const visMap: Record<string, number> = { 'Faint': 3, 'Clear': 6, 'Very Clear': 9 };
    const visibilityNum = formData.visibilityLevel ? visMap[formData.visibilityLevel] : 5;

    // Build payload for API
    const payload = {
      userReportID: user.id,
      latitude: latitudeVal,
      longitude: longitudeVal,
      description: formData.description,
      ghostID: (formData.ghostID && formData.ghostID !== 'unknown') ? formData.ghostID : null,
      timeOfSighting: formData.timeOfSighting,
      visibility: visibilityNum
    };

    console.log('Submitting sighting with payload:', payload);

    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8100';
    const resp = await fetch(`${apiBase}/api/sightings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    console.log('Response status:', resp.status);

    if (resp.status === 201) {
      const data = await resp.json();
      
      // Find the ghost name if a ghostID was selected
      let selectedGhostName = 'Unknown';
      if (formData.ghostID && formData.ghostID !== 'unknown') {
        const selectedGhost = ghosts.find(g => g.id === formData.ghostID);
        if (selectedGhost) {
          selectedGhostName = selectedGhost.name;
        }
      }
      
      // Build a GhostSighting from the response
      const created: GhostSighting = {
        id: String(data.id),
        visibility: Number(data.visibility || 0),
        time: data.time ? new Date(data.time) : new Date(),
        userReportID: String(data.userReportID || user.id),
        latitude: (data.latitude !== undefined && data.latitude !== null) ? Number(data.latitude) : null,
        longitude: (data.longitude !== undefined && data.longitude !== null) ? Number(data.longitude) : null,
        description: data.description || formData.description || '',
        ghostName: selectedGhostName
      } as any;
      setIsSubmitting(false);
      setSubmitted(true);
      onSubmitSighting(created);
    } else {
      const err = await resp.json().catch(() => ({}));
      console.error(err.error || err.message || `Registration failed (${resp.status})`);
      setIsSubmitting(false);
    }
    
    // Reset form after 3 seconds
    setTimeout(() => {
      setSubmitted(false);
      setFormData({
        latitude: '',
        longitude: '',
        description: '',
        ghostID: 'unknown',
        timeOfSighting: '',
        visibilityLevel: ''
      });
    }, 3000);
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <Card className="text-center">
          <CardContent className="pt-6">
            <h2 className="text-xl mb-2">Ghost Sighting Reported!</h2>
            <p className="text-muted-foreground">
              Thank you for contributing to our paranormal database.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <span>Report a Ghost Sighting</span>
          </CardTitle>
          <p className="text-muted-foreground">
            Help document paranormal activity on campus. Please be as detailed as possible.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2 grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="latitude" className="flex items-center space-x-2">
                  <MapPin className="w-4 h-4" />
                  <span>Latitude</span>
                </Label>
                <Input
                  id="latitude"
                  placeholder="e.g., 38.0336"
                  value={formData.latitude}
                  onChange={(e) => setFormData(prev => ({ ...prev, latitude: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="longitude" className="flex items-center space-x-2">
                  <MapPin className="w-4 h-4" />
                  <span>Longitude</span>
                </Label>
                <Input
                  id="longitude"
                  placeholder="e.g., -78.5035"
                  value={formData.longitude}
                  onChange={(e) => setFormData(prev => ({ ...prev, longitude: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeOfSighting" className="flex items-center space-x-2">
                <Clock className="w-4 h-4" />
                <span>Time of Sighting</span>
              </Label>
              <Input
                id="timeOfSighting"
                placeholder="e.g., 11:30 PM on October 15th, Around midnight last Tuesday"
                value={formData.timeOfSighting}
                onChange={(e) => setFormData(prev => ({ ...prev, timeOfSighting: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ghostID">Known Ghost (Optional)</Label>
              <Select
                value={formData.ghostID}
                onValueChange={(value: string) => setFormData(prev => ({ 
                  ...prev, 
                  ghostID: value 
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingGhosts ? "Loading ghosts..." : "Select a known ghost or leave as Unknown"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unknown">Unknown Ghost</SelectItem>
                  {ghosts.map(ghost => (
                    <SelectItem key={ghost.id} value={ghost.id}>
                      {ghost.name} ({ghost.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                If you don't select a known ghost, the sighting will be recorded as "Unknown"
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center space-x-2">
                <Eye className="w-4 h-4" />
                <span>Visibility Level</span>
              </Label>
              <Select
                value={formData.visibilityLevel}
                onValueChange={(value: string) => setFormData(prev => ({ 
                  ...prev, 
                  visibilityLevel: value as 'Faint' | 'Clear' | 'Very Clear' 
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="How clearly did you see it?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Faint">Faint - Barely visible, could have been imagination</SelectItem>
                  <SelectItem value="Clear">Clear - Definitely saw something paranormal</SelectItem>
                  <SelectItem value="Very Clear">Very Clear - Distinct and unmistakable</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Detailed Description</Label>
              <Textarea
                id="description"
                placeholder="Describe what you saw, heard, or felt. Include any interactions, sounds, movements, or other details..."
                className="min-h-32"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting Report...' : 'Submit Ghost Sighting'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}