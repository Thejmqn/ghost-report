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
  latitude?: number | null;
  longitude?: number | null;
  description: string;
}

export type Screen = 'login' | 'report' | 'browse' | 'profile';