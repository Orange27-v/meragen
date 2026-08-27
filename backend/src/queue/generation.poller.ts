import { Injectable, Logger } from '@nestjs/common';
import { GenerationStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { GenerationsService } from '../generations/generations.service';
import { MAX_POLL_MS, pollDelayMs } from './queue.constants';

export interface SweepResult {
  checked: number;
  completed: number;
  failed: number;
  stillRunning: number;
}

/**
 * Chases every in-flight generation to a conclusion.
 *
 * Why a database sweep rather than self-requeueing queue jobs: Postgres already
 * holds the authoritative list of unfinished work, so this survives a worker
 * crash, a Redis flush, and the gap between "vendor accepted the job" and "job
 * reached the queue". A job cannot be silently abandoned — if a row says
 * `processing`, something will keep asking about it until it resolves or times
 * out and refunds.
 *
 * (BullMQ's delayed jobs were the first design here; delayed promotion proved
 * unreliable in practice, and the sweep is the sturdier answer regardless.)
 */
@Injectable()
export class GenerationPoller {
  private readonly logger = new Logger(GenerationPoller.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly generations: GenerationsService,
  ) {}

  async sweep(now = new Date()): Promise<SweepResult> {
    // Guard against ticks overlapping if a sweep runs long.
    if (this.running) return { checked: 0, completed: 0, failed: 0, stillRunning: 0 };
    this.running = true;

    try {
      const candidates = await this.prisma.generation.findMany({
        where: { status: { in: [GenerationStatus.queued, GenerationStatus.processing] } },
        select: { id: true, createdAt: true, lastPolledAt: true },
        orderBy: { createdAt: 'asc' },
        take: 200,
      });

      const result: SweepResult = { checked: 0, completed: 0, failed: 0, stillRunning: 0 };

      for (const row of candidates) {
        const elapsed = now.getTime() - row.createdAt.getTime();

        // Back off on long-running jobs rather than asking every tick.
        const sinceLastPoll = row.lastPolledAt ? now.getTime() - row.lastPolledAt.getTime() : Infinity;
        if (sinceLastPoll < pollDelayMs(elapsed)) continue;

        if (elapsed > MAX_POLL_MS) {
          this.logger.error(`Generation ${row.id} timed out after ${Math.round(elapsed / 1000)}s`);
          await this.generations.failTimedOut(row.id);
          result.checked++;
          result.failed++;
          continue;
        }

        result.checked++;
        try {
          const refreshed = await this.generations.refresh(row.id);
          if (refreshed.status === GenerationStatus.completed) result.completed++;
          else if (refreshed.status === GenerationStatus.failed) result.failed++;
          else result.stillRunning++;
        } catch (error) {
          // One bad row must never stop the sweep for everyone else.
          this.logger.error(`Sweep failed for ${row.id}: ${(error as Error).message}`);
        } finally {
          await this.prisma.generation.update({
            where: { id: row.id },
            data: { lastPolledAt: now },
          }).catch(() => undefined);
        }
      }

      if (result.checked > 0) {
        this.logger.debug(
          `Sweep: ${result.checked} checked, ${result.completed} completed, ` +
            `${result.failed} failed, ${result.stillRunning} running`,
        );
      }
      return result;
    } finally {
      this.running = false;
    }
  }
}
