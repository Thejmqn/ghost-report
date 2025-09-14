import { Button } from './ui/button';
import { Screen, User } from '../types';
import { Ghost, FileText, Search, User as UserIcon, LogOut } from 'lucide-react';

interface NavigationProps {
  currentScreen: Screen;
  onScreenChange: (screen: Screen) => void;
  user: User;
  onLogout: () => void;
}

export function Navigation({ currentScreen, onScreenChange, user, onLogout }: NavigationProps) {
  const navItems = [
    { screen: 'report' as Screen, label: 'Report Ghost', icon: Ghost },
    { screen: 'browse' as Screen, label: 'Browse Sightings', icon: Search },
    { screen: 'profile' as Screen, label: 'My Profile', icon: UserIcon }
  ];

  return (
    <nav className="bg-card border-b border-border px-4 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-1">
          <h1 className="text-lg">Campus Ghost Reports</h1>
        </div>
        
        <div className="flex items-center space-x-2">
          {navItems.map(({ screen, label, icon: Icon }) => (
            <Button
              key={screen}
              variant={currentScreen === screen ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onScreenChange(screen)}
              className="flex items-center space-x-2"
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
            </Button>
          ))}
          
          <div className="ml-4 flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">
              Welcome, {user.username}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onLogout}
              className="flex items-center space-x-1"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}