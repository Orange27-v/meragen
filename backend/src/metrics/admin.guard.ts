import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AuthGuard, AuthedRequest } from '../auth/auth.guard';
import { PrismaService } from '../common/prisma.service';
import { MetricsService } from './metrics.service';

/**
 * Owner-only.
 *
 * These numbers include revenue, margin and every customer's spend. Membership
 * comes from the ADMIN_EMAILS environment variable and is checked on each
 * request — there is deliberately no way for anything a customer touches to
 * grant it.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly auth: AuthGuard,
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Must be signed in first.
    await this.auth.canActivate(context);

    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const user = await this.prisma.user.findUnique({
      where: { id: request.userId! },
      select: { email: true },
    });

    if (!user || !this.metrics.isAdminEmail(user.email)) {
      // Same answer as any other forbidden route: this endpoint's existence is
      // not worth confirming to someone who cannot use it.
      throw new ForbiddenException('Not found');
    }
    return true;
  }
}
