import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import { config } from '../config.js';
import { LoginDto } from './auth.dto.js';
import { AuthService } from './auth.service.js';
import type { AuthUser } from './auth.types.js';
import { CurrentUser, Public } from './decorators.js';
import { TokenService } from './token.service.js';

export const REFRESH_COOKIE = 'refresh_token';

function refreshCookieOptions(): CookieOptions {
  const cfg = config();
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: cfg.NODE_ENV === 'production',
    path: '/',
    maxAge: cfg.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
  ) {}

  /** Refresh token dikirim sebagai cookie httpOnly (browser) dan di body (klien lain). */
  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(dto.email, dto.password);
    res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions());
    return result;
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cookies = req.cookies as Record<string, string | undefined> | undefined;
    const body = req.body as { refreshToken?: unknown } | undefined;
    const fromBody = typeof body?.refreshToken === 'string' ? body.refreshToken : undefined;
    const token = fromBody ?? cookies?.[REFRESH_COOKIE] ?? '';
    const result = await this.auth.refresh(token);
    res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions());
    return result;
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response): void {
    const opts = refreshCookieOptions();
    delete opts.maxAge;
    res.clearCookie(REFRESH_COOKIE, opts);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  @Public()
  @Get('.well-known/jwks.json')
  jwks() {
    return this.tokens.jwks;
  }
}
