import { HttpStatus, Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CoreClient } from '../clients/core.client.js';
import { AppError } from '../common/app-error.js';
import type { Scope } from './scope.js';

@Injectable()
export class ScopeService {
  constructor(private readonly core: CoreClient) {}

  forUser(user: AuthUser): Promise<Scope> {
    return this.forUserId(user.id);
  }

  async forUserId(userId: string): Promise<Scope> {
    const s = await this.core.scope(userId);
    if (!s.user.aktif) {
      throw new AppError(HttpStatus.UNAUTHORIZED, 'USER_INACTIVE', 'Akun tidak aktif');
    }
    return {
      all: s.all,
      manageDaerah: new Set(s.manageDaerah),
      manageDesa: new Set(s.manageDesa),
      manageKelompok: new Set(s.manageKelompok),
      visibleDaerah: new Set(s.visibleDaerah),
      visibleDesa: new Set(s.visibleDesa),
    };
  }
}
