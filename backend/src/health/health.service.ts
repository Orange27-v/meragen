import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import { FirebaseService } from '../auth/firebase.service';
import { StorageService } from '../storage/storage.service';

export type CheckState = 'ok' | 'degraded' | 'down';

export interface Check {
  name: string;
  state: CheckState;
  detail: string;
  /** True when the platform cannot do its job without this. */
  critical: boolean;
}

export interface Health {
  status: CheckState;
  checks: Check[];
}

/**
 * What is and is not working, in one place.
 *
 * The reason this exists: sign-in is Google-only, so Firebase is now
 * load-bearing. A missing key used to be invisible until a real customer
 * couldn't get in. Now it is visible from a single URL, at startup, and to any
 * uptime monitor.
 *
 * `critical` marks the things that stop the business: no sign-in, no payments,
 * no database. Everything else degrades without taking the platform down.
 */
@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly firebase: FirebaseService,
    private readonly storage: StorageService,
  ) {}

  async check(): Promise<Health> {
    const checks: Check[] = [
      await this.database(),
      this.signIn(),
      this.payments(),
      this.generation(),
      this.fileStorage(),
    ];

    const worst: CheckState = checks.some((c) => c.critical && c.state === 'down')
      ? 'down'
      : checks.some((c) => c.state !== 'ok')
        ? 'degraded'
        : 'ok';

    return { status: worst, checks };
  }

  private async database(): Promise<Check> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { name: 'database', state: 'ok', detail: 'connected', critical: true };
    } catch (error) {
      return { name: 'database', state: 'down', detail: (error as Error).message, critical: true };
    }
  }

  /** Google is the only way in, so this being down means nobody can sign in. */
  private signIn(): Check {
    return this.firebase.enabled
      ? { name: 'sign-in', state: 'ok', detail: 'Google sign-in ready', critical: true }
      : {
          name: 'sign-in',
          state: 'down',
          detail: 'Firebase is not configured — NOBODY CAN SIGN IN. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.',
          critical: true,
        };
  }

  private payments(): Check {
    const key = this.config.get<string>('PAYSTACK_SECRET_KEY', '');
    if (!key) {
      return { name: 'payments', state: 'down', detail: 'PAYSTACK_SECRET_KEY is not set — nobody can buy credits.', critical: true };
    }
    return key.startsWith('sk_live_')
      ? { name: 'payments', state: 'ok', detail: 'Paystack live', critical: true }
      : { name: 'payments', state: 'degraded', detail: 'Paystack in TEST mode — no real money moves.', critical: true };
  }

  private generation(): Check {
    return this.config.get<string>('MUAPI_KEY')
      ? { name: 'generation', state: 'ok', detail: 'MuAPI configured', critical: false }
      : {
          name: 'generation',
          state: 'down',
          detail: 'MUAPI_KEY is not set — every generation will fail and refund.',
          critical: false,
        };
  }

  private fileStorage(): Check {
    return this.storage.backendName === 'r2'
      ? { name: 'storage', state: 'ok', detail: 'Cloudflare R2', critical: false }
      : {
          name: 'storage',
          state: 'degraded',
          detail: 'Local disk — fine for development, will lose files in production.',
          critical: false,
        };
  }

  /**
   * Prints the state of the world at startup.
   *
   * Loud on purpose: a critical dependency missing is the difference between a
   * working business and a landing page nobody can sign into.
   */
  async report(): Promise<Health> {
    const health = await this.check();

    for (const check of health.checks) {
      const line = `${check.name.padEnd(11)} ${check.detail}`;
      if (check.state === 'down' && check.critical) this.logger.error(`✗ ${line}`);
      else if (check.state === 'down') this.logger.warn(`✗ ${line}`);
      else if (check.state === 'degraded') this.logger.warn(`~ ${line}`);
      else this.logger.log(`✓ ${line}`);
    }

    if (health.status === 'down') {
      this.logger.error('SERVICE IS NOT USABLE — a critical dependency above is missing.');
    }
    return health;
  }
}
