import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard, AuthedRequest } from '../auth/auth.guard';
import { PrismaService } from './prisma.service';
import { isAdminEmail } from './admins';

/**
 * Owner-only.
 *
 * Membership comes from the ADMIN_EMAILS environment variable and is checked on
 * each request — there is deliberately no way for anything a customer touches to
 * grant it.
 *
 * This lives in `common` rather than beside the metrics routes because two
 * unrelated things need it: the dashboard that shows every customer's spend,
 * and the catalogue sync that rewrites what we charge. A guard that answers
 * "is this the owner?" should not have to import a metrics service to do it.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly auth: AuthGuard,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Must be signed in first.
    await this.auth.canActivate(context);

    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const user = await this.prisma.user.findUnique({
      where: { id: request.userId! },
      select: { email: true },
    });

    if (!user || !isAdminEmail(user.email, this.config.get<string>('ADMIN_EMAILS', ''))) {
      // Same answer as any other forbidden route: this endpoint's existence is
      // not worth confirming to someone who cannot use it.
      throw new ForbiddenException('Not found');
    }
    return true;
  }
}
