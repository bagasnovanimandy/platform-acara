import { type CanActivate, type ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { AppError } from '../common/app-error.js';
import { config } from '../config.js';

/** Untuk endpoint /internal/*: header `x-internal-key` harus sama dengan INTERNAL_KEY. */
@Injectable()
export class InternalKeyGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const expected = config().INTERNAL_KEY;
    const given = ctx.switchToHttp().getRequest<Request>().headers['x-internal-key'];
    if (expected && typeof given === 'string' && given.length === expected.length) {
      if (timingSafeEqual(Buffer.from(given), Buffer.from(expected))) return true;
    }
    throw new AppError(
      HttpStatus.UNAUTHORIZED,
      'INTERNAL_KEY_INVALID',
      'Kunci internal tidak valid',
    );
  }
}
