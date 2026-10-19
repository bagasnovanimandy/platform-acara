import { create } from 'zustand';
import type { AuthUser, Role } from './api';

interface AuthState {
  /** Access token hanya di memori; refresh token di cookie httpOnly. */
  accessToken: string | null;
  user: AuthUser | null;
  status: 'unknown' | 'authenticated' | 'anonymous';
  setSession: (accessToken: string, user: AuthUser) => void;
  clear: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  status: 'unknown',
  setSession: (accessToken, user) => set({ accessToken, user, status: 'authenticated' }),
  clear: () => set({ accessToken: null, user: null, status: 'anonymous' }),
}));

export const canEdit = (user: AuthUser | null): boolean =>
  user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  PENGURUS: 'Pengurus',
  AUDITOR: 'Auditor',
};

/** Boleh melihat riwayat perubahan (audit). */
export const canAudit = (user: AuthUser | null): boolean =>
  user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || user?.role === 'AUDITOR';
