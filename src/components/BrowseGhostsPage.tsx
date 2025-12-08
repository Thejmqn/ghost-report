import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Eye, Search, Ghost as GhostIcon } from 'lucide-react';

interface Ghost {
  id: number;
  type: string;
  name: string;
  description: string;
  visibility: number;
}

interface BrowseGhostsPageProps {
  onSelectGhost: (ghost: Ghost) => void;
}

export function BrowseGhostsPage({ onSelectGhost }: BrowseGhostsPageProps) {
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchGhosts = async () => {
      const apiBase = import.meta.env.VITE_API_URL || 'https://ghost-report-backend.azurewebsites.net';
      try {
        const resp = await fetch(`${apiBase}/api/ghosts`);
        if (!resp.ok) {
          throw new Error(`Failed to load ghosts: ${resp.status}`);
        }
        const data = await resp.json();
        setGhosts(data || []);
      } catch (err) {
        console.error('Error fetching ghosts:', err);
        setError(err instanceof Error ? err.message : 'Failed to load ghosts');
      } finally {
        setLoading(false);
      }
    };

    fetchGhosts();
  }, []);

  const filteredGhosts = ghosts.filter(ghost => {
    const matchesSearch = 
      ghost.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ghost.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ghost.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

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

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="text-center py-12">
          <p>Loading ghosts...</p>
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
      <div className="mb-6">
        <h1 className="text-2xl mb-4 flex items-center space-x-2">
          <GhostIcon className="w-6 h-6" />
          <span>Known Ghosts</span>
        </h1>
        
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search by name, type, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <p className="text-muted-foreground">
          {filteredGhosts.length} of {ghosts.length} ghosts
        </p>
      </div>

      {filteredGhosts.length === 0 ? (
        <Card className="text-center">
          <CardContent className="py-12">
            <h3 className="text-lg mb-2">No Ghosts Found</h3>
            <p className="text-muted-foreground">
              {ghosts.length === 0 
                ? "No ghosts have been catalogued yet."
                : "Try adjusting your search terms."
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredGhosts.map((ghost) => (
            <Card 
              key={ghost.id} 
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => onSelectGhost(ghost)}
            >
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <GhostIcon className="w-5 h-5" />
                    <span>{ghost.name}</span>
                  </CardTitle>
                  <Badge className={getVisibilityColor(ghost.visibility)}>
                    <Eye className="w-3 h-3 mr-1" />
                    {getVisibilityLabel(ghost.visibility)}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Type</p>
                  <p className="font-medium">{ghost.type}</p>
                </div>
                
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Description</p>
                  <p className="text-foreground leading-relaxed">
                    {ghost.description || 'No description available.'}
                  </p>
                </div>
                
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">
                    Visibility Rating: {ghost.visibility}/10 • Click for details
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}