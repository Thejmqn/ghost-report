export interface User {
  id: string;
  username: string;
  email: string;
}

export interface GhostSighting {
  id: string;
  userId: string;
  username: string;
  location: string;
  description: string;
  ghostType: string;
  timeOfSighting: string;
  visibilityLevel: 'Faint' | 'Clear' | 'Very Clear';
  timestamp: Date;
}

export type Screen = 'login' | 'report' | 'browse' | 'profile';