import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { AppError } from '../common/app-error.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { verifyOperatorToken } from './operator-token.js';

export interface OperatorCtx {
  id: string;
  sesiId: string;
  label: string;
}

declare module 'express' {
  interface Request {
    operator?: OperatorCtx;
  }
}

const unauthorized = (message: string) =>
  new AppError(HttpStatus.UNAUTHORIZED, 'OPERATOR_UNAUTHORIZED', message);

/** Endpoint perangkat pintu: token operator (HS256) dan OperatorSession masih berlaku. */
@Injectable()
export class OperatorGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) throw unauthorized('Perangkat belum login');
    let sid: string;
    try {
      ({ sid } = await verifyOperatorToken(token));
    } catch {
      throw unauthorized('Login perangkat kedaluwarsa, scan QR lagi');
    }
    const op = await this.prisma.operatorSession.findUnique({ where: { id: sid } });
    if (op?.revokedAt) {
      throw new AppError(
        HttpStatus.UNAUTHORIZED,
        'OPERATOR_DICABUT',
        'Akses pintu ini dicabut admin',
      );
    }
    if (!op || op.expiresAt < new Date()) {
      throw unauthorized('Akses perangkat sudah dicabut atau habis');
    }
    req.operator = { id: op.id, sesiId: op.sesiId, label: op.label };
    return true;
  }
}

export const CurrentOperator = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): OperatorCtx => {
    const op = ctx.switchToHttp().getRequest<Request>().operator;
    if (!op) throw new Error('CurrentOperator tanpa OperatorGuard');
    return op;
  },
);
