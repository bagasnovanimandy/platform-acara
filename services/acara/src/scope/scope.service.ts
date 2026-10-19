import { HttpStatus, Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { AppError } from '../common/app-error.js';
import { CoreClient } from '../core/core.client.js';
import type { Scope } from './scope.js';

@Injectable()
export class ScopeService {
  constructor(private readonly core: CoreClient) {}

  async forUser(user: AuthUser): Promise<Scope> {
    const s = await this.core.scope(user.id);
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
