import { HttpStatus, Injectable } from '@nestjs/common';
import { AppError } from '../common/app-error.js';
import { config } from '../config.js';
import type { User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser } from './auth.types.js';
import { dummyVerify, hashPassword, isLegacyHash, verifyPassword } from './password.js';
import { type IssuedTokens, TokenService } from './token.service.js';

const toAuthUser = (u: Pick<User, 'id' | 'role' | 'nama' | 'email'>): AuthUser => ({
  id: u.id,
  role: u.role,
  nama: u.nama,
  email: u.email,
});

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async login(email: string, password: string): Promise<IssuedTokens & { user: AuthUser }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      await dummyVerify(password);
      throw this.invalid();
    }
    if (!(await verifyPassword(user.passwordHash, password))) throw this.invalid();
    if (!user.aktif)
      throw new AppError(HttpStatus.FORBIDDEN, 'USER_INACTIVE', 'Akun dinonaktifkan');
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        ...(isLegacyHash(user.passwordHash) ? { passwordHash: await hashPassword(password) } : {}),
      },
    });
    const authUser = toAuthUser(user);
    return { ...(await this.tokens.issue(authUser)), user: authUser };
  }

  async refresh(refreshToken: string): Promise<IssuedTokens & { user: AuthUser }> {
    let claims: AuthUser;
    try {
      claims = await this.tokens.verify(refreshToken, 'refresh');
    } catch {
      throw new AppError(
        HttpStatus.UNAUTHORIZED,
        'REFRESH_INVALID',
        'Sesi berakhir, silakan login lagi',
      );
    }
    // Ambil data terbaru: role/nama bisa berubah, user bisa dinonaktifkan.
    const user = await this.prisma.user.findUnique({ where: { id: claims.id } });
    if (!user?.aktif) {
      throw new AppError(
        HttpStatus.UNAUTHORIZED,
        'REFRESH_INVALID',
        'Sesi berakhir, silakan login lagi',
      );
    }
    const authUser = toAuthUser(user);
    return { ...(await this.tokens.issue(authUser)), user: authUser };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nama: true,
        email: true,
        role: true,
        noWa: true,
        anggotaId: true,
        lastLoginAt: true,
        sikuRoles: true,
        scopes: { select: { level: true, refId: true } },
      },
    });
    if (!user) throw new AppError(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', 'Silakan login');
    // Menu "Keuangan (SiKU)" tampil bila user punya peran SiKU dan alamat SiKU sudah diatur.
    return { ...user, sikuTersedia: user.sikuRoles.length > 0 && Boolean(config().SIKU_URL) };
  }

  private invalid(): AppError {
    return new AppError(HttpStatus.UNAUTHORIZED, 'LOGIN_FAILED', 'Email atau password salah');
  }
}
