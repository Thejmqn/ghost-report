export interface User {
  id: string;
  username: string;
  email: string;
}

export interface GhostSighting {
  id: string;
  visibility: number;
  time: Date;
  userReportID: string;
  latitude: number | null;
  longitude: number | null;
  description: string;
  ghostName?: string;
}

export interface Tour {
  id: string;
  startTime: Date;
  endTime: Date;
  guide: string;
  path: string;
  ghostCount?: number;
  signupCount?: number;
  isSignedUp?: boolean;
}

export interface Ghost {
  id: number;
  type: string;
  name: string;
  description: string;
  visibility: number;
}

export type Screen = 'login' | 'report' | 'browse' | 'profile' | 'ghosts' | 'tours';
