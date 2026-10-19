import type { Role } from '../generated/prisma/client.js';

/** User yang sudah terautentikasi (diambil dari access token). */
export interface AuthUser {
  id: string;
  role: Role;
  nama: string;
  email: string;
}

export type TokenType = 'access' | 'refresh';

declare module 'express' {
  interface Request {
    user?: AuthUser;
  }
}
