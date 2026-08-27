import { Injectable, Logger } from '@nestjs/common';
import { Prisma, CreditTransaction, CreditTransactionType } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { InsufficientCreditsError, AlreadyRefundedError } from './credits.errors';

/**
 * The credit ledger. Every balance change in the product goes through here.
 *
 * Three invariants this class exists to hold (planning.md §2):
 *
 *   1. A balance never goes negative.
 *   2. `sum(credit_transactions.amount) == users.credit_balance`, always.
 *   3. Concurrent charges cannot both read the same stale balance and both
 *      succeed. Every mutation takes `SELECT ... FOR UPDATE` on the user row
 *      first, which serialises writers per user.
 *
 * Everything runs inside one transaction: lock -> insert ledger row -> update
 * cached balance. If any step throws, none of it happened.
 */
@Injectable()
export class CreditsService {
  private readonly logger = new Logger(CreditsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Locks the user row for the remainder of the surrounding transaction and
   * returns the authoritative balance.
   *
   * `FOR UPDATE` is what makes concurrency safe: a second transaction touching
   * the same user blocks here until the first commits, so it reads the balance
   * *after* that commit rather than racing it.
   */
  private async lockBalance(tx: Prisma.TransactionClient, userId: string): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ credit_balance: number }>>`
      SELECT credit_balance FROM users WHERE id = ${userId}::uuid FOR UPDATE
    `;
    if (rows.length === 0) throw new Error(`No such user: ${userId}`);
    return rows[0].credit_balance;
  }

  /**
   * Applies a signed delta under an already-held lock.
   * Callers are responsible for opening the transaction and validating intent.
   */
  private async applyDelta(
    tx: Prisma.TransactionClient,
    params: {
      userId: string;
      amount: number;
      type: CreditTransactionType;
      generationId?: string;
      paystackRef?: string;
      idempotencyKey?: string;
    },
  ): Promise<CreditTransaction> {
    const current = await this.lockBalance(tx, params.userId);
    const next = current + params.amount;

    if (next < 0) {
      throw new InsufficientCreditsError(Math.abs(params.amount), current);
    }

    const entry = await tx.creditTransaction.create({
      data: {
        userId: params.userId,
        type: params.type,
        amount: params.amount,
        balanceAfter: next,
        generationId: params.generationId ?? null,
        paystackRef: params.paystackRef ?? null,
        idempotencyKey: params.idempotencyKey ?? null,
      },
    });

    await tx.user.update({
      where: { id: params.userId },
      data: { creditBalance: next },
    });

    return entry;
  }

  /**
   * Charges a user for a generation.
   *
   * Throws InsufficientCreditsError if the balance cannot cover it — the caller
   * must treat that as "do not enqueue the job".
   *
   * With an `idempotencyKey`, charging twice with the same key is safe: the
   * second attempt returns the original entry instead of taking the money
   * again. That is what makes a retried worker, a double-fired scheduler or a
   * resubmitted request harmless — the alternative is charging a customer twice
   * for one thing, which is the worst bug this system could have.
   */
  async charge(params: {
    userId: string;
    credits: number;
    generationId?: string;
    idempotencyKey?: string;
  }): Promise<CreditTransaction> {
    if (params.credits <= 0) {
      throw new Error('charge() requires a positive credit amount');
    }

    try {
      return await this.prisma.$transaction((tx) =>
        this.applyDelta(tx, {
          userId: params.userId,
          amount: -params.credits,
          type: CreditTransactionType.generation_charge,
          generationId: params.generationId,
          idempotencyKey: params.idempotencyKey,
        }),
      );
    } catch (error) {
      if (
        params.idempotencyKey &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.creditTransaction.findUnique({
          where: { idempotencyKey: params.idempotencyKey },
        });
        if (existing) {
          this.logger.log(`Repeat charge for ${params.idempotencyKey} absorbed — already charged`);
          return existing;
        }
      }
      throw error;
    }
  }

  /**
   * Refunds a failed generation.
   *
   * Guarded by `generations.refunded_at` rather than by the caller remembering:
   * a worker retry, a webhook replay and a manual re-run all land here, and only
   * the first one may write a ledger entry.
   */
  async refundGeneration(generationId: string): Promise<CreditTransaction | null> {
    return this.prisma.$transaction(async (tx) => {
      // Lock the generation row first, so two concurrent refunds serialise here
      // before either reaches the user row.
      const locked = await tx.$queryRaw<Array<{ user_id: string; cost_credits: number; refunded_at: Date | null }>>`
        SELECT user_id, cost_credits, refunded_at
        FROM generations
        WHERE id = ${generationId}::uuid
        FOR UPDATE
      `;
      if (locked.length === 0) throw new Error(`No such generation: ${generationId}`);

      const generation = locked[0];
      if (generation.refunded_at !== null) {
        throw new AlreadyRefundedError(generationId);
      }
      if (generation.cost_credits <= 0) return null;

      const entry = await this.applyDelta(tx, {
        userId: generation.user_id,
        amount: generation.cost_credits,
        type: CreditTransactionType.refund,
        generationId,
      });

      await tx.generation.update({
        where: { id: generationId },
        data: { refundedAt: new Date() },
      });

      return entry;
    });
  }

  /**
   * Credits a confirmed Paystack payment.
   *
   * `paystackRef` carries a unique constraint, so a webhook delivered twice
   * raises P2002 on the second attempt and we return the original entry instead
   * of crediting again (planning.md §2.3).
   *
   * `created` distinguishes a real top-up from an absorbed replay — callers log
   * on it, so an ops timeline shows one credit per payment rather than one per
   * webhook delivery.
   */
  async topup(params: {
    userId: string;
    credits: number;
    paystackRef: string;
  }): Promise<{ entry: CreditTransaction; created: boolean }> {
    if (params.credits <= 0) {
      throw new Error('topup() requires a positive credit amount');
    }

    try {
      const entry = await this.prisma.$transaction((tx) =>
        this.applyDelta(tx, {
          userId: params.userId,
          amount: params.credits,
          type: CreditTransactionType.topup,
          paystackRef: params.paystackRef,
        }),
      );
      return { entry, created: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.prisma.creditTransaction.findUnique({
          where: { paystackRef: params.paystackRef },
        });
        if (existing) return { entry: existing, created: false };
      }
      throw error;
    }
  }

  /** Cached balance — fine for display. Use `audit()` when correctness matters. */
  async getBalance(userId: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { creditBalance: true },
    });
    if (!user) throw new Error(`No such user: ${userId}`);
    return user.creditBalance;
  }

  /**
   * Reconciliation: replays the ledger and compares it to the cached balance.
   * Runs as a scheduled job in production; any drift is a bug worth paging over.
   */
  async audit(userId: string): Promise<{ ledgerSum: number; cachedBalance: number; consistent: boolean }> {
    const [aggregate, user] = await Promise.all([
      this.prisma.creditTransaction.aggregate({
        where: { userId },
        _sum: { amount: true },
      }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { creditBalance: true } }),
    ]);
    if (!user) throw new Error(`No such user: ${userId}`);

    const ledgerSum = aggregate._sum.amount ?? 0;
    return {
      ledgerSum,
      cachedBalance: user.creditBalance,
      consistent: ledgerSum === user.creditBalance,
    };
  }
}
