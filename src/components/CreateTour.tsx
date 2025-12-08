import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { ArrowLeft, Plus } from 'lucide-react';
import { User, Ghost } from '../types';

interface CreateTourProps {
  user: User;
  onBack: () => void;
  onTourCreated: () => void;
}

export function CreateTour({ user, onBack, onTourCreated }: CreateTourProps) {
  const [guide, setGuide] = useState('');
  const [path, setPath] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedGhosts, setSelectedGhosts] = useState<number[]>([]);
  const [availableGhosts, setAvailableGhosts] = useState<Ghost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGhosts();
  }, []);

  const fetchGhosts = async () => {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8100';
    try {
      const resp = await fetch(`${apiBase}/api/ghosts`);
      if (!resp.ok) {
        throw new Error(`Failed to load ghosts: ${resp.status}`);
      }
      const data = await resp.json();
      setAvailableGhosts(data || []);
    } catch (err) {
      console.error('Error fetching ghosts:', err);
    }
  };

  const toggleGhost = (ghostId: number) => {
    setSelectedGhosts(prev => 
      prev.includes(ghostId) 
        ? prev.filter(id => id !== ghostId)
        : [...prev, ghostId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!guide.trim() || !path.trim() || !startDate || !startTime || !endDate || !endTime) {
      setError('Please fill in all fields');
      return;
    }

    if (selectedGhosts.length === 0) {
      setError('Please select at least one ghost for the tour');
      return;
    }

    const startDateTime = new Date(`${startDate}T${startTime}`);
    const endDateTime = new Date(`${endDate}T${endTime}`);

    if (endDateTime <= startDateTime) {
      setError('End time must be after start time');
      return;
    }

    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8100';
    setLoading(true);

    try {
      const resp = await fetch(`${apiBase}/api/tours`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guide: guide.trim(),
          path: path.trim(),
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          ghostIDs: selectedGhosts
        })
      });

      if (!resp.ok) {
        const errorData = await resp.json();
        throw new Error(errorData.error || `Failed to create tour: ${resp.status}`);
      }

      onTourCreated();
    } catch (err) {
      console.error('Error creating tour:', err);
      setError(err instanceof Error ? err.message : 'Failed to create tour');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <Button
        variant="ghost"
        onClick={onBack}
        className="mb-4 flex items-center space-x-2"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Tours</span>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Plus className="w-5 h-5" />
            <span>Create New Tour</span>
          </CardTitle>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-md text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="guide">Guide Name</Label>
              <Input
                id="guide"
                value={guide}
                onChange={(e) => setGuide(e.target.value)}
                placeholder="Your name or tour guide name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="path">Tour Route</Label>
              <Textarea
                id="path"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="e.g., Old Town Square -> Haunted Manor -> Cemetery Gates"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">End Time</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Select Ghosts for Tour</Label>
              <div className="border rounded-md p-4 max-h-64 overflow-y-auto space-y-2">
                {availableGhosts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No ghosts available</p>
                ) : (
                  availableGhosts.map((ghost) => (
                    <div key={ghost.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`ghost-${ghost.id}`}
                        checked={selectedGhosts.includes(ghost.id)}
                        onCheckedChange={() => toggleGhost(ghost.id)}
                      />
                      <label
                        htmlFor={`ghost-${ghost.id}`}
                        className="text-sm cursor-pointer flex-1"
                      >
                        {ghost.name} ({ghost.type})
                      </label>
                    </div>
                  ))
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedGhosts.length} ghost(s) selected
              </p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? 'Creating...' : 'Create Tour'}
              </Button>
              <Button type="button" variant="outline" onClick={onBack}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}