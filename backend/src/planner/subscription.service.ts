import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreditsService } from '../credits/credits.service';
import { InsufficientCreditsError } from '../credits/credits.errors';
import { NAIRA_PER_CREDIT } from '../pricing/money';

/** ₦3,000 a month, in credits. */
export const PLANNER_MONTHLY_CREDITS = 60;

export interface SubscriptionView {
  active: boolean;
  monthlyCredits: number;
  monthlyNaira: number;
  renewsAt: Date | null;
  pausedAt: Date | null;
  /** Why it is paused, in words the customer can act on. */
  note: string | null;
}

/**
 * The Post Planner add-on.
 *
 * Billed in credits from the balance the customer already has, once a month —
 * not a recurring card mandate. That means no card kept on file, no failed
 * renewals to chase, and if someone runs out of credits the add-on simply
 * pauses instead of locking them out or piling up debt. It also keeps the
 * "no subscription trap" promise honest: cancelling is a button, not an email.
 */
@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly credits: CreditsService,
  ) {}

  private static view(row: {
    active: boolean; monthlyCredits: number; renewsAt: Date; pausedAt: Date | null;
  } | null): SubscriptionView {
    if (!row) {
      return {
        active: false,
        monthlyCredits: PLANNER_MONTHLY_CREDITS,
        monthlyNaira: PLANNER_MONTHLY_CREDITS * NAIRA_PER_CREDIT,
        renewsAt: null,
        pausedAt: null,
        note: null,
      };
    }
    return {
      active: row.active,
      monthlyCredits: row.monthlyCredits,
      monthlyNaira: row.monthlyCredits * NAIRA_PER_CREDIT,
      renewsAt: row.renewsAt,
      pausedAt: row.pausedAt,
      note: row.pausedAt
        ? 'Paused because there were not enough credits to renew. Top up and turn it back on.'
        : null,
    };
  }

  async get(userId: string): Promise<SubscriptionView> {
    return SubscriptionService.view(
      await this.prisma.subscription.findUnique({ where: { userId } }),
    );
  }

  async isActive(userId: string): Promise<boolean> {
    const row = await this.prisma.subscription.findUnique({
      where: { userId },
      select: { active: true },
    });
    return row?.active === true;
  }

  /** Turns the add-on on, charging the first month now. */
  async start(userId: string): Promise<SubscriptionView> {
    const existing = await this.prisma.subscription.findUnique({ where: { userId } });
    if (existing?.active) return SubscriptionService.view(existing);

    try {
      await this.credits.charge({
        userId,
        credits: PLANNER_MONTHLY_CREDITS,
        // Distinct from the renewal key below. They used to share a shape, and
        // a first renewal falling on the sign-up date was silently absorbed as
        // a duplicate — the customer got a free month and we never charged it.
        idempotencyKey: `planner-start:${userId}:${new Date().toISOString().slice(0, 10)}`,
      });
    } catch (error) {
      if (error instanceof InsufficientCreditsError) {
        throw new BadRequestException({
          error: 'insufficient_credits',
          message: `Post Planner costs ${PLANNER_MONTHLY_CREDITS} credits a month (₦${(PLANNER_MONTHLY_CREDITS * NAIRA_PER_CREDIT).toLocaleString()}). Top up to switch it on.`,
          required: error.required,
          available: error.available,
        });
      }
      throw error;
    }

    const renewsAt = new Date();
    renewsAt.setMonth(renewsAt.getMonth() + 1);

    const row = await this.prisma.subscription.upsert({
      where: { userId },
      create: { userId, monthlyCredits: PLANNER_MONTHLY_CREDITS, renewsAt, lastChargedAt: new Date() },
      update: { active: true, renewsAt, lastChargedAt: new Date(), pausedAt: null },
    });

    this.logger.log(`Post Planner started for ${userId}`);
    return SubscriptionService.view(row);
  }

  /** Off immediately. No notice period, no email to send. */
  async stop(userId: string): Promise<SubscriptionView> {
    const row = await this.prisma.subscription.update({
      where: { userId },
      data: { active: false, pausedAt: null },
    }).catch(() => null);

    if (!row) throw new BadRequestException('Post Planner is not switched on.');
    this.logger.log(`Post Planner cancelled by ${userId}`);
    return SubscriptionService.view(row);
  }

  /**
   * Charges everyone whose month is up.
   *
   * Run daily by the worker. A customer without enough credits is paused, not
   * charged into a negative balance and not silently kept running for free.
   */
  async renewDue(now = new Date()): Promise<{ renewed: number; paused: number }> {
    const due = await this.prisma.subscription.findMany({
      where: { active: true, renewsAt: { lte: now } },
      take: 200,
    });

    let renewed = 0;
    let paused = 0;

    for (const subscription of due) {
      const period = subscription.renewsAt.toISOString().slice(0, 10);
      try {
        await this.credits.charge({
          userId: subscription.userId,
          credits: subscription.monthlyCredits,
          // Keyed to the period being paid for, so a double run cannot charge
          // twice — and prefixed so it can never collide with the start charge.
          idempotencyKey: `planner-renew:${subscription.userId}:${period}`,
        });

        const next = new Date(subscription.renewsAt);
        next.setMonth(next.getMonth() + 1);

        await this.prisma.subscription.update({
          where: { id: subscription.id },
          data: { renewsAt: next, lastChargedAt: now, pausedAt: null },
        });
        renewed++;
      } catch (error) {
        if (error instanceof InsufficientCreditsError) {
          await this.prisma.subscription.update({
            where: { id: subscription.id },
            data: { active: false, pausedAt: now },
          });
          paused++;
          this.logger.warn(`Post Planner paused for ${subscription.userId}: not enough credits`);
          continue;
        }
        this.logger.error(`Renewal failed for ${subscription.userId}: ${(error as Error).message}`);
      }
    }

    if (renewed || paused) this.logger.log(`Post Planner renewals: ${renewed} charged, ${paused} paused`);
    return { renewed, paused };
  }
}
