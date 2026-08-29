import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GenerationStatus, CreditTransactionType } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { NAIRA_PER_CREDIT } from '../pricing/money';
import { paystackFeeKobo } from '../pricing/infrastructure';
import { isAdminEmail } from '../common/admins';

export interface Metrics {
  windowDays: number;
  people: {
    signups: number;
    paying: number;
    /** Signup to first payment. The number the whole model rests on. */
    conversionPercent: number;
    returning: number;
    /** Paid once, never came back. The retention risk, measured. */
    churnedPercent: number;
  };
  money: {
    grossNaira: number;
    paystackFeesNaira: number;
    netNaira: number;
    vendorCostNaira: number;
    /** What we actually kept, after the vendor and after Paystack. */
    realisedMarginPercent: number;
    creditsOutstanding: number;
    /** Credits sold but unspent — money owed in service, not profit. */
    liabilityNaira: number;
  };
  work: {
    generations: number;
    completed: number;
    failed: number;
    failureRatePercent: number;
    refundedNaira: number;
    perPayingUser: number;
  };
  stickiness: {
    savedAssets: number;
    usersWithSavedAssets: number;
    plannerSubscribers: number;
  };
  topModels: Array<{ modelId: string; runs: number; naira: number }>;
}

/**
 * The real numbers, computed from the ledger rather than estimated.
 *
 * Every financial projection in the plan is an assumption until this runs
 * against live traffic (planning.md §7 Phase 12). The two that matter most are
 * signup-to-paid conversion and churn: the revenue model assumes steady
 * retention, and without the stickiness layer working, user count plateaus as
 * churn cancels out new signups.
 */
@Injectable()
export class MetricsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Emails allowed to see this, from the environment only. */
  isAdminEmail(email: string): boolean {
    return isAdminEmail(email, this.config.get<string>('ADMIN_EMAILS', ''));
  }

  async collect(windowDays = 30): Promise<Metrics> {
    const since = new Date(Date.now() - windowDays * 24 * 3600 * 1000);

    const [
      signups, payingRows, topups, charges, refunds,
      generations, completed, failed, vendorCost,
      outstanding, savedAssets, stickyUsers, plannerSubs, byModel, returningRows,
    ] = await Promise.all([
      this.prisma.user.count({ where: { createdAt: { gte: since } } }),

      // Anyone who has ever paid, in the window.
      this.prisma.creditTransaction.findMany({
        where: { type: CreditTransactionType.topup, createdAt: { gte: since } },
        select: { userId: true, amount: true },
      }),

      this.prisma.creditTransaction.aggregate({
        where: { type: CreditTransactionType.topup, createdAt: { gte: since } },
        _sum: { amount: true }, _count: true,
      }),
      this.prisma.creditTransaction.aggregate({
        where: { type: CreditTransactionType.generation_charge, createdAt: { gte: since } },
        _sum: { amount: true },
      }),
      this.prisma.creditTransaction.aggregate({
        where: { type: CreditTransactionType.refund, createdAt: { gte: since } },
        _sum: { amount: true },
      }),

      this.prisma.generation.count({ where: { createdAt: { gte: since } } }),
      this.prisma.generation.count({ where: { createdAt: { gte: since }, status: GenerationStatus.completed } }),
      this.prisma.generation.count({ where: { createdAt: { gte: since }, status: GenerationStatus.failed } }),
      this.prisma.generation.aggregate({
        where: { createdAt: { gte: since }, status: GenerationStatus.completed },
        _sum: { vendorCostUsdCents: true },
      }),

      this.prisma.user.aggregate({ _sum: { creditBalance: true } }),
      this.prisma.brandAsset.count(),
      this.prisma.brandAsset.groupBy({ by: ['userId'] }),
      this.prisma.subscription.count({ where: { active: true } }),

      this.prisma.generation.groupBy({
        by: ['modelId'],
        where: { createdAt: { gte: since }, status: GenerationStatus.completed },
        _count: true,
        _sum: { costCredits: true },
        orderBy: { _count: { modelId: 'desc' } },
        take: 8,
      }),

      // Came back and paid more than once — the opposite of churn.
      this.prisma.creditTransaction.groupBy({
        by: ['userId'],
        where: { type: CreditTransactionType.topup },
        _count: true,
      }),
    ]);

    const payingUserIds = new Set(payingRows.map((row) => row.userId));
    const paying = payingUserIds.size;

    const grossKobo = payingRows.reduce((total, row) => total + row.amount * NAIRA_PER_CREDIT * 100, 0);
    // Fee is per transaction, so it must be summed per payment, not on the total.
    const feesKobo = payingRows.reduce(
      (total, row) => total + paystackFeeKobo(row.amount * NAIRA_PER_CREDIT * 100), 0,
    );
    const netKobo = grossKobo - feesKobo;

    const vendorNaira = ((vendorCost._sum.vendorCostUsdCents ?? 0) / 100) *
      Number(this.config.get<string>('NGN_PER_USD', '1500'));

    const spentCredits = Math.abs(charges._sum.amount ?? 0) - (refunds._sum.amount ?? 0);
    const revenueRecognisedKobo = spentCredits * NAIRA_PER_CREDIT * 100;

    const repeatBuyers = returningRows.filter((row) => row._count > 1).length;
    const everPaid = returningRows.length;

    return {
      windowDays,
      people: {
        signups,
        paying,
        conversionPercent: signups > 0 ? round((paying / signups) * 100) : 0,
        returning: repeatBuyers,
        churnedPercent: everPaid > 0 ? round(((everPaid - repeatBuyers) / everPaid) * 100) : 0,
      },
      money: {
        grossNaira: grossKobo / 100,
        paystackFeesNaira: feesKobo / 100,
        netNaira: netKobo / 100,
        vendorCostNaira: round(vendorNaira),
        // Measured on credits actually spent, not on credits sold: unspent
        // credits are a liability, not revenue.
        realisedMarginPercent: revenueRecognisedKobo > 0
          ? round(((revenueRecognisedKobo / 100 - vendorNaira) / (revenueRecognisedKobo / 100)) * 100)
          : 0,
        creditsOutstanding: outstanding._sum.creditBalance ?? 0,
        liabilityNaira: (outstanding._sum.creditBalance ?? 0) * NAIRA_PER_CREDIT,
      },
      work: {
        generations,
        completed,
        failed,
        failureRatePercent: generations > 0 ? round((failed / generations) * 100) : 0,
        refundedNaira: (refunds._sum.amount ?? 0) * NAIRA_PER_CREDIT,
        perPayingUser: paying > 0 ? round(generations / paying) : 0,
      },
      stickiness: {
        savedAssets,
        usersWithSavedAssets: stickyUsers.length,
        plannerSubscribers: plannerSubs,
      },
      topModels: byModel.map((row) => ({
        modelId: row.modelId,
        runs: row._count,
        naira: (row._sum.costCredits ?? 0) * NAIRA_PER_CREDIT,
      })),
    };
  }

  /** Signups and revenue per day, for the trend lines. */
  async daily(days = 30): Promise<Array<{ date: string; signups: number; naira: number; generations: number }>> {
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);

    const rows = await this.prisma.$queryRaw<Array<{ date: Date; signups: bigint; naira: bigint; generations: bigint }>>`
      WITH days AS (
        SELECT generate_series(${since}::date, CURRENT_DATE, '1 day')::date AS date
      )
      SELECT
        d.date,
        (SELECT count(*) FROM users u WHERE u.created_at::date = d.date) AS signups,
        COALESCE((SELECT sum(t.amount) * ${NAIRA_PER_CREDIT}
                  FROM credit_transactions t
                  WHERE t.type = 'topup' AND t.created_at::date = d.date), 0) AS naira,
        (SELECT count(*) FROM generations g WHERE g.created_at::date = d.date) AS generations
      FROM days d
      ORDER BY d.date
    `;

    return rows.map((row) => ({
      date: row.date.toISOString().slice(0, 10),
      signups: Number(row.signups),
      naira: Number(row.naira),
      generations: Number(row.generations),
    }));
  }
}

const round = (value: number): number => Math.round(value * 10) / 10;
