import { type CanActivate, type ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { AppError } from '../common/app-error.js';
import { config } from '../config.js';
import type { Role } from '../generated/prisma/client.js';
import { IS_PUBLIC, ROLES } from './decorators.js';
import { TokenService } from './token.service.js';

/** Global: wajib Bearer access token kecuali endpoint @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;
    const req = ctx.switchToHttp().getRequest<Request>();
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) throw new AppError(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', 'Silakan login');
    try {
      req.user = await this.tokens.verify(token, 'access');
    } catch {
      throw new AppError(
        HttpStatus.UNAUTHORIZED,
        'TOKEN_INVALID',
        'Sesi tidak valid atau kedaluwarsa',
      );
    }
    return true;
  }
}

/** Global: cek @Roles(). Tanpa @Roles() semua user login boleh. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;
    const user = ctx.switchToHttp().getRequest<Request>().user;
    if (!user) return true; // endpoint publik
    if (user.role === 'SUPER_ADMIN' || roles.includes(user.role)) return true;
    throw new AppError(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Anda tidak punya akses');
  }
}

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
