import { type CanActivate, type ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { AppError } from '../common/app-error.js';
import { config } from '../config.js';
import type { AuthUser, Role } from './auth.types.js';
import { IS_PUBLIC, ROLES } from './decorators.js';

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

/** Verifikasi access token core-svc lewat JWKS (kunci di-cache oleh jose). */
export async function verifyAccessToken(token: string): Promise<AuthUser> {
  const cfg = config();
  jwks ??= createRemoteJWKSet(new URL('/auth/.well-known/jwks.json', cfg.CORE_URL));
  const { payload } = await jwtVerify(token, jwks, {
    issuer: cfg.JWT_ISSUER,
    audience: cfg.JWT_AUDIENCE,
  });
  if (payload.typ !== 'access' || typeof payload.sub !== 'string') {
    throw new Error('Tipe token salah');
  }
  return {
    id: payload.sub,
    role: payload.role as Role,
    nama: String(payload.nama ?? ''),
    email: String(payload.email ?? ''),
  };
}

/** Global: wajib Bearer access token kecuali endpoint @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

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
      req.user = await verifyAccessToken(token);
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
    if (!user) return true;
    if (user.role === 'SUPER_ADMIN' || roles.includes(user.role)) return true;
    throw new AppError(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Anda tidak punya akses');
  }
}
