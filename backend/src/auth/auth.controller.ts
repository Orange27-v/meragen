import { Controller, Post, Get, Body, Req, UseGuards, HttpCode, BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { AuthGuard, AuthedRequest } from './auth.guard';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request) {
    const header = req.headers.authorization;
    const token =
      (req.headers['x-api-key'] as string | undefined) ??
      (header?.startsWith('Bearer ') ? header.slice(7) : '');
    await this.auth.logout(token);
    return { ok: true };
  }

  /**
   * Exchange a Firebase ID token for a Meerah session.
   *
   * The browser never tells us who it is — it hands over Google's signed token
   * and we check it with Google ourselves.
   */
  @Post('google')
  @HttpCode(200)
  async google(@Body() body: { idToken?: string }) {
    if (!body?.idToken) throw new BadRequestException('idToken is required');
    return this.auth.continueWithGoogle(body.idToken);
  }

  /**
   * Whether sign-in is available at all.
   *
   * Google is the only route, so `google: false` means nobody can get in — the
   * sign-in page shows a real explanation instead of a dead button.
   */
  @Get('methods')
  methods() {
    return { google: this.auth.googleEnabled };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async me(@Req() req: AuthedRequest) {
    return this.auth.me(req.userId!);
  }
}
