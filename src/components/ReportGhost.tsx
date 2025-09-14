import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { GhostSighting, User } from '../types';
import { MapPin, Clock, Eye } from 'lucide-react';

interface ReportGhostProps {
  user: User;
  onSubmitSighting: (sighting: Omit<GhostSighting, 'id' | 'timestamp'>) => void;
}

export function ReportGhost({ user, onSubmitSighting }: ReportGhostProps) {
  const [formData, setFormData] = useState({
    location: '',
    description: '',
    ghostType: '',
    timeOfSighting: '',
    visibilityLevel: '' as 'Faint' | 'Clear' | 'Very Clear' | ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    const sighting: Omit<GhostSighting, 'id' | 'timestamp'> = {
      userId: user.id,
      username: user.username,
      location: formData.location,
      description: formData.description,
      ghostType: formData.ghostType,
      timeOfSighting: formData.timeOfSighting,
      visibilityLevel: formData.visibilityLevel as 'Faint' | 'Clear' | 'Very Clear'
    };

    onSubmitSighting(sighting);
    setIsSubmitting(false);
    setSubmitted(true);

    // Reset form after 3 seconds
    setTimeout(() => {
      setSubmitted(false);
      setFormData({
        location: '',
        description: '',
        ghostType: '',
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
            <div className="space-y-2">
              <Label htmlFor="location" className="flex items-center space-x-2">
                <MapPin className="w-4 h-4" />
                <span>Location on Campus</span>
              </Label>
              <Input
                id="location"
                placeholder="e.g., Library 3rd floor, Main Hall basement, Dormitory C"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                required
              />
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
              <Label htmlFor="ghostType">Type of Apparition</Label>
              <Input
                id="ghostType"
                placeholder="e.g., Translucent figure, Shadow person, Orb of light"
                value={formData.ghostType}
                onChange={(e) => setFormData(prev => ({ ...prev, ghostType: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center space-x-2">
                <Eye className="w-4 h-4" />
                <span>Visibility Level</span>
              </Label>
              <Select
                value={formData.visibilityLevel}
                onValueChange={(value) => setFormData(prev => ({ 
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