import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { randomBytes, createHash } from 'node:crypto';
import { AuthProvider } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import { isAdminEmail } from '../common/admins';
import { FirebaseService } from './firebase.service';

const SESSION_DAYS = 30;

export interface AuthResult {
  token: string;
  user: { id: string; email: string; creditBalance: number };
}

/**
 * Google is the only way in.
 *
 * There is no password anywhere in this system — not stored, not hashed, not
 * checked. Nothing to leak, nothing to reset, nothing to guess, and no support
 * burden for forgotten credentials. Google handles the identity; we handle the
 * session, the credits and the ledger.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly firebase: FirebaseService,
    private readonly config: ConfigService,
  ) {}

  /** False means nobody can sign in — the API says so plainly rather than 500ing. */
  get googleEnabled(): boolean {
    return this.firebase.enabled;
  }

  private static hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Issues a session.
   *
   * Only the SHA-256 of the token is stored, so a leaked database dump cannot
   * be used to impersonate anyone — the raw token exists nowhere but the user's
   * own browser.
   */
  private async issueSession(userId: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    await this.prisma.session.create({
      data: {
        userId,
        tokenHash: AuthService.hashToken(token),
        expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000),
      },
    });
    return token;
  }

  /**
   * Signs in, creating the account on first use.
   *
   * One call for both: Google does not distinguish between a new and a
   * returning person, and asking a customer whether they are "new" is a
   * question they should not have to answer.
   */
  async continueWithGoogle(idToken: string): Promise<AuthResult> {
    const identity = await this.firebase.verifyIdToken(idToken);

    // Match on either, so an account created before this change is found by
    // email and adopted rather than duplicated.
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ firebaseUid: identity.firebaseUid }, { email: identity.email }] },
    });

    if (existing) {
      const user =
        existing.firebaseUid === identity.firebaseUid
          ? existing
          : await this.prisma.user.update({
              where: { id: existing.id },
              data: { firebaseUid: identity.firebaseUid, emailVerified: true },
            });

      this.logger.log(`Signed in: ${identity.email}`);
      return {
        token: await this.issueSession(user.id),
        user: { id: user.id, email: user.email, creditBalance: user.creditBalance },
      };
    }

    const created = await this.prisma.user.create({
      data: {
        email: identity.email,
        firebaseUid: identity.firebaseUid,
        authProvider: AuthProvider.google,
        emailVerified: true,
      },
    });

    this.logger.log(`New account: ${identity.email}`);
    return {
      token: await this.issueSession(created.id),
      user: { id: created.id, email: created.email, creditBalance: created.creditBalance },
    };
  }

  /** Resolves a session token to a user id, or null. */
  async resolve(token: string): Promise<string | null> {
    if (!token) return null;

    const session = await this.prisma.session.findUnique({
      where: { tokenHash: AuthService.hashToken(token) },
      select: { id: true, userId: true, expiresAt: true },
    });
    if (!session) return null;

    if (session.expiresAt.getTime() < Date.now()) {
      await this.prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
      return null;
    }

    // Cheap liveness signal; not awaited on the request path.
    void this.prisma.session
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
      .catch(() => undefined);

    return session.userId;
  }

  /** Ends one session, leaving the person's other devices signed in. */
  async logout(token: string): Promise<void> {
    await this.prisma.session
      .deleteMany({ where: { tokenHash: AuthService.hashToken(token) } })
      .catch(() => undefined);
  }

  async me(userId: string): Promise<{
    id: string; email: string; creditBalance: number; isAdmin: boolean;
  }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, creditBalance: true },
    });
    // Lets the dashboard decide whether to render the owner link at all. It is
    // a display hint only: the metrics route re-checks the same list on every
    // request, so forging this flag in the browser buys nothing.
    return { ...user, isAdmin: isAdminEmail(user.email, this.config.get<string>('ADMIN_EMAILS', '')) };
  }
}
