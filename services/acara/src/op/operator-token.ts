import { jwtVerify, SignJWT } from 'jose';
import { config } from '../config.js';

const ISSUER = 'acara-svc';
const AUDIENCE = 'operator';

export interface OperatorClaims {
  /** OperatorSession.id */
  sid: string;
  sesiId: string;
}

const key = () => new TextEncoder().encode(config().OPERATOR_JWT_SECRET);

export function signOperatorToken(c: OperatorClaims, expiresAt: Date): Promise<string> {
  return new SignJWT({ typ: 'operator', sesiId: c.sesiId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(c.sid)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(key());
}

export async function verifyOperatorToken(token: string): Promise<OperatorClaims> {
  const { payload } = await jwtVerify(token, key(), { issuer: ISSUER, audience: AUDIENCE });
  if (payload.typ !== 'operator' || typeof payload.sub !== 'string') {
    throw new Error('Tipe token salah');
  }
  return { sid: payload.sub, sesiId: String(payload.sesiId) };
}
