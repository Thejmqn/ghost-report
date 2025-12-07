import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { GhostSighting } from '../types';
import { MapPin, Clock, User, Eye, Search, Filter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface BrowseGhostsProps {
  sightings: GhostSighting[];
  onSelectSighting: (sighting: GhostSighting) => void;
}

export function BrowseGhosts({ sightings, onSelectSighting }: BrowseGhostsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState('all');

  const filteredSightings = sightings.filter(sighting => {
    const loc = (sighting.latitude !== undefined && sighting.latitude !== null && sighting.longitude !== undefined && sighting.longitude !== null)
      ? `${sighting.latitude}, ${sighting.longitude}`
      : 'Unknown location';

    const matchesSearch = 
      String(loc).toLowerCase().includes(searchTerm.toLowerCase()) ||
      sighting.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const sightingVisibility = (sighting.visibility >= 8) ? 'Very Clear' : (sighting.visibility >=5 ? 'Clear' : 'Faint');
    const matchesVisibility = visibilityFilter === 'all' || sightingVisibility === visibilityFilter;
    
    return matchesSearch && matchesVisibility;
  });

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
        <h1 className="text-2xl mb-4 flex items-center space-x-2">
          <span>Campus Ghost Sightings</span>
        </h1>
        
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search by location, description, or ghost type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex items-center space-x-2 sm:w-48">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Visibility</SelectItem>
                <SelectItem value="Faint">Faint</SelectItem>
                <SelectItem value="Clear">Clear</SelectItem>
                <SelectItem value="Very Clear">Very Clear</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <p className="text-muted-foreground">
          {filteredSightings.length} of {sightings.length} sightings
        </p>
      </div>

      {filteredSightings.length === 0 ? (
        <Card className="text-center">
          <CardContent className="py-12">
            <h3 className="text-lg mb-2">No Ghost Sightings Found</h3>
            <p className="text-muted-foreground">
              {sightings.length === 0 
                ? "Be the first to report a paranormal encounter!"
                : "Try adjusting your search terms or filters."
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredSightings.map((sighting) => (
            <Card 
              key={sighting.id} 
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => onSelectSighting(sighting)}
            >
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <CardTitle className="text-lg flex items-start space-x-2">
                    <span>{(sighting as any).ghostName || 'Unknown'}</span>
                  </CardTitle>
                  <Badge className={getVisibilityColor((sighting.visibility >= 8) ? 'Very Clear' : (sighting.visibility >=5 ? 'Clear' : 'Faint'))}>
                    <Eye className="w-3 h-3 mr-1" />
                    {(sighting.visibility >= 8) ? 'Very Clear' : (sighting.visibility >=5 ? 'Clear' : 'Faint')}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center space-x-1">
                    <MapPin className="w-4 h-4" />
                    <span>{(sighting.latitude !== null && sighting.longitude !== null) ? `${sighting.latitude}, ${sighting.longitude}` : 'Unknown location'}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Clock className="w-4 h-4" />
                    <span>{sighting.time ? new Date(sighting.time).toLocaleString() : 'Unknown time'}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <User className="w-4 h-4" />
                    <span>Reported by User #{sighting.userReportID}</span>
                  </div>
                </div>
                
                <p className="text-foreground leading-relaxed">
                  {sighting.description}
                </p>
                
                <div className="text-xs text-muted-foreground pt-2 border-t">
                  Submitted on {sighting.time ? new Date(sighting.time).toLocaleDateString() : 'Unknown'} at{' '}
                  {sighting.time ? new Date(sighting.time).toLocaleTimeString() : ''}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}