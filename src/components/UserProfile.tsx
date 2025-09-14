import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { GhostSighting, User } from '../types';
import { Edit, Trash2, MapPin, Clock, Eye, Save, X } from 'lucide-react';

interface UserProfileProps {
  user: User;
  userSightings: GhostSighting[];
  onUpdateSighting: (id: string, updatedSighting: Partial<GhostSighting>) => void;
  onDeleteSighting: (id: string) => void;
}

export function UserProfile({ user, userSightings, onUpdateSighting, onDeleteSighting }: UserProfileProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<GhostSighting>>({});

  const startEditing = (sighting: GhostSighting) => {
    setEditingId(sighting.id);
    setEditForm({
      location: sighting.location,
      description: sighting.description,
      ghostType: sighting.ghostType,
      timeOfSighting: sighting.timeOfSighting,
      visibilityLevel: sighting.visibilityLevel
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = () => {
    if (editingId && editForm) {
      onUpdateSighting(editingId, editForm);
      setEditingId(null);
      setEditForm({});
    }
  };

  const getVisibilityColor = (level: string) => {
    switch (level) {
      case 'Faint': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'Clear': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      case 'Very Clear': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <span>User Profile</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Username</p>
                <p>{user.username}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p>{user.email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Sightings</p>
                <p className="text-lg">{userSightings.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-xl mb-4 flex items-center space-x-2">
        <span>My Ghost Sightings</span>
      </h2>

      {userSightings.length === 0 ? (
        <Card className="text-center">
          <CardContent className="py-12">
            <h3 className="text-lg mb-2">No Sightings Reported Yet</h3>
            <p className="text-muted-foreground">
              Visit the "Report Ghost" section to document your first paranormal encounter!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {userSightings.map((sighting) => (
            <Card key={sighting.id}>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <CardTitle className="text-lg flex items-start space-x-2">
                    {editingId === sighting.id ? (
                      <Input
                        value={editForm.ghostType || ''}
                        onChange={(e) => setEditForm(prev => ({ ...prev, ghostType: e.target.value }))}
                        className="text-lg"
                        placeholder="Ghost type"
                      />
                    ) : (
                      <span>{sighting.ghostType}</span>
                    )}
                  </CardTitle>
                  
                  <div className="flex items-center space-x-2">
                    {editingId === sighting.id ? (
                      <Select
                        value={editForm.visibilityLevel || sighting.visibilityLevel}
                        onValueChange={(value) => setEditForm(prev => ({ 
                          ...prev, 
                          visibilityLevel: value as 'Faint' | 'Clear' | 'Very Clear' 
                        }))}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Faint">Faint</SelectItem>
                          <SelectItem value="Clear">Clear</SelectItem>
                          <SelectItem value="Very Clear">Very Clear</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge className={getVisibilityColor(sighting.visibilityLevel)}>
                        <Eye className="w-3 h-3 mr-1" />
                        {sighting.visibilityLevel}
                      </Badge>
                    )}
                    
                    {editingId === sighting.id ? (
                      <div className="flex space-x-1">
                        <Button size="sm" onClick={saveEdit}>
                          <Save className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEditing}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex space-x-1">
                        <Button size="sm" variant="ghost" onClick={() => startEditing(sighting)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost">
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Ghost Sighting</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this ghost sighting? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => onDeleteSighting(sighting.id)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    <Label>Location:</Label>
                  </div>
                  {editingId === sighting.id ? (
                    <Input
                      value={editForm.location || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, location: e.target.value }))}
                      placeholder="Location"
                    />
                  ) : (
                    <p>{sighting.location}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <Label>Time of Sighting:</Label>
                  </div>
                  {editingId === sighting.id ? (
                    <Input
                      value={editForm.timeOfSighting || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, timeOfSighting: e.target.value }))}
                      placeholder="Time of sighting"
                    />
                  ) : (
                    <p>{sighting.timeOfSighting}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Description:</Label>
                  {editingId === sighting.id ? (
                    <Textarea
                      value={editForm.description || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                      className="min-h-24"
                      placeholder="Description"
                    />
                  ) : (
                    <p className="leading-relaxed">{sighting.description}</p>
                  )}
                </div>
                
                <div className="text-xs text-muted-foreground pt-2 border-t">
                  Submitted on {new Date(sighting.timestamp).toLocaleDateString()} at{' '}
                  {new Date(sighting.timestamp).toLocaleTimeString()}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}