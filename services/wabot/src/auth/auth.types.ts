export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'PENGURUS' | 'AUDITOR';

/** User dari access token core-svc. */
export interface AuthUser {
  id: string;
  role: Role;
  nama: string;
  email: string;
}

declare module 'express' {
  interface Request {
    user?: AuthUser;
  }
}
