import { randomUUID } from 'node:crypto';
import { Injectable, type OnModuleInit } from '@nestjs/common';
import { jwtVerify, SignJWT, type JWK } from 'jose';
import { config } from '../config.js';
import type { Role } from '../generated/prisma/client.js';
import type { AuthUser, TokenType } from './auth.types.js';
import { loadSigningKeys, type SigningKeys } from './keys.js';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class TokenService implements OnModuleInit {
  private keys?: SigningKeys;

  async onModuleInit(): Promise<void> {
    const cfg = config();
    this.keys = await loadSigningKeys({
      pem: cfg.JWT_PRIVATE_KEY,
      file: cfg.JWT_PRIVATE_KEY_FILE,
      allowGenerate: cfg.NODE_ENV !== 'production',
    });
  }

  /** Untuk test: pakai kunci yang sudah ada. */
  useKeys(keys: SigningKeys): void {
    this.keys = keys;
  }

  get jwks(): { keys: JWK[] } {
    return { keys: [this.requireKeys().jwk] };
  }

  async issue(user: AuthUser): Promise<IssuedTokens> {
    const cfg = config();
    const accessToken = await this.sign(user, 'access', cfg.ACCESS_TOKEN_TTL);
    const refreshToken = await this.sign(user, 'refresh', `${cfg.REFRESH_TOKEN_TTL_DAYS}d`);
    const { payload } = await jwtVerify(accessToken, this.requireKeys().publicKey);
    const expiresIn = (payload.exp ?? 0) - (payload.iat ?? 0);
    return { accessToken, refreshToken, expiresIn };
  }

  /** Verifikasi token & tipenya. Melempar bila tidak valid/kedaluwarsa. */
  async verify(token: string, typ: TokenType): Promise<AuthUser> {
    const cfg = config();
    const { payload } = await jwtVerify(token, this.requireKeys().publicKey, {
      issuer: cfg.JWT_ISSUER,
      audience: cfg.JWT_AUDIENCE,
      algorithms: ['RS256'],
    });
    if (payload.typ !== typ || typeof payload.sub !== 'string') throw new Error('Tipe token salah');
    return {
      id: payload.sub,
      role: payload.role as Role,
      nama: String(payload.nama ?? ''),
      email: String(payload.email ?? ''),
    };
  }

  /**
   * Token sekali pakai untuk masuk ke SiKU (aud = SIKU_AUDIENCE, berlaku 60 detik).
   * SiKU memverifikasi lewat JWKS, menolak jti yang sudah dipakai, lalu membuat sesinya sendiri.
   */
  async issueSso(user: AuthUser, sikuRoles: string[]): Promise<string> {
    const cfg = config();
    const keys = this.requireKeys();
    return new SignJWT({ typ: 'sso', email: user.email, nama: user.nama, sikuRoles })
      .setProtectedHeader({ alg: 'RS256', kid: keys.kid })
      .setSubject(user.id)
      .setIssuer(cfg.JWT_ISSUER)
      .setAudience(cfg.SIKU_AUDIENCE)
      .setJti(randomUUID())
      .setIssuedAt()
      .setExpirationTime('60s')
      .sign(keys.privateKey);
  }

  private async sign(user: AuthUser, typ: TokenType, ttl: string): Promise<string> {
    const cfg = config();
    const keys = this.requireKeys();
    return new SignJWT({ typ, role: user.role, nama: user.nama, email: user.email })
      .setProtectedHeader({ alg: 'RS256', kid: keys.kid })
      .setSubject(user.id)
      .setIssuer(cfg.JWT_ISSUER)
      .setAudience(cfg.JWT_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(ttl)
      .sign(keys.privateKey);
  }

  private requireKeys(): SigningKeys {
    if (!this.keys) throw new Error('Kunci JWT belum dimuat');
    return this.keys;
  }
}
