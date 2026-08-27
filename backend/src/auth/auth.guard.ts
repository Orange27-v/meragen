import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';

export interface AuthedRequest extends Request {
  userId?: string;
}

/**
 * Accepts the session token as either `x-api-key` or `Authorization: Bearer`.
 *
 * `x-api-key` is not an accident: the forked studio already sends its token in
 * that header, so keeping it means those components need no change at all
 * (planning.md §4).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthedRequest>();

    const header = request.headers.authorization;
    const token =
      (request.headers['x-api-key'] as string | undefined) ??
      (header?.startsWith('Bearer ') ? header.slice(7) : undefined);

    const userId = token ? await this.auth.resolve(token) : null;
    if (!userId) throw new UnauthorizedException('Sign in to continue.');

    request.userId = userId;
    return true;
  }
}
