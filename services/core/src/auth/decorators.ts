import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { Role } from '../generated/prisma/client.js';
import type { AuthUser } from './auth.types.js';

export const IS_PUBLIC = 'isPublic';
export const ROLES = 'roles';

/** Endpoint tanpa login. */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC, true);

/** Batasi endpoint ke role tertentu. SUPER_ADMIN selalu lolos. */
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES, roles);

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const user = ctx.switchToHttp().getRequest<Request>().user;
    if (!user) throw new Error('CurrentUser dipakai di endpoint publik');
    return user;
  },
);
