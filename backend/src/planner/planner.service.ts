import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ScheduledPostStatus, PostPlatform, GenerationStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { GenerationsService } from '../generations/generations.service';
import { InsufficientCreditsError } from '../credits/credits.errors';

/**
 * Start generating this long before a post is due.
 *
 * A 4K render can take minutes and the vendor can be busy; starting early means
 * the work is finished and waiting rather than still rendering at the moment it
 * was meant to go out.
 */
export const LEAD_TIME_MS = 20 * 60 * 1000;

/** Nothing may be scheduled closer than this, or there is no time to make it. */
const MIN_NOTICE_MS = 5 * 60 * 1000;
const MAX_AHEAD_DAYS = 180;

export interface PlannedPost {
  id: string;
  scheduledFor: Date;
  status: ScheduledPostStatus;
  platform: PostPlatform;
  tierId: string;
  prompt: string;
  caption: string | null;
  outputUrl: string | null;
  errorMessage: string | null;
}

/**
 * The content calendar.
 *
 * Plan a week of posts on Sunday, and the platform makes each one shortly
 * before it is due. This is what turns the product from a generator into
 * something that keeps working when the customer is busy (planning.md §7
 * Phase 11) — and it is the second revenue line, billed as a monthly add-on.
 */
@Injectable()
export class PlannerService {
  private readonly logger = new Logger(PlannerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly generations: GenerationsService,
  ) {}

  private static view(row: {
    id: string; scheduledFor: Date; status: ScheduledPostStatus; platform: PostPlatform;
    tierId: string; prompt: string; caption: string | null; errorMessage: string | null;
    generation?: { outputUrl: string | null } | null;
  }): PlannedPost {
    return {
      id: row.id,
      scheduledFor: row.scheduledFor,
      status: row.status,
      platform: row.platform,
      tierId: row.tierId,
      prompt: row.prompt,
      caption: row.caption,
      outputUrl: row.generation?.outputUrl ?? null,
      errorMessage: row.errorMessage,
    };
  }

  async list(userId: string, from?: Date, to?: Date): Promise<PlannedPost[]> {
    const rows = await this.prisma.scheduledPost.findMany({
      where: {
        userId,
        ...(from || to ? { scheduledFor: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      },
      orderBy: { scheduledFor: 'asc' },
      include: { generation: { select: { outputUrl: true } } },
    });
    return rows.map(PlannerService.view);
  }

  async schedule(params: {
    userId: string;
    scheduledFor: Date;
    tierId: string;
    prompt: string;
    caption?: string;
    platform?: PostPlatform;
  }): Promise<PlannedPost> {
    const when = params.scheduledFor;
    if (Number.isNaN(when.getTime())) throw new BadRequestException('That date could not be read.');

    const now = Date.now();
    if (when.getTime() < now + MIN_NOTICE_MS) {
      throw new BadRequestException('Schedule it at least 5 minutes ahead so there is time to make it.');
    }
    if (when.getTime() > now + MAX_AHEAD_DAYS * 24 * 3600 * 1000) {
      throw new BadRequestException(`You can plan up to ${MAX_AHEAD_DAYS} days ahead.`);
    }
    if (!params.prompt?.trim()) {
      throw new BadRequestException('Say what the post should show.');
    }

    const row = await this.prisma.scheduledPost.create({
      data: {
        userId: params.userId,
        scheduledFor: when,
        tierId: params.tierId,
        prompt: params.prompt.trim(),
        caption: params.caption?.trim() || null,
        platform: params.platform ?? PostPlatform.manual,
      },
      include: { generation: { select: { outputUrl: true } } },
    });

    this.logger.log(`Planned ${row.id} for ${when.toISOString()} (user ${params.userId})`);
    return PlannerService.view(row);
  }

  async cancel(userId: string, id: string): Promise<PlannedPost> {
    const row = await this.prisma.scheduledPost.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException('No such planned post');

    if (row.status === ScheduledPostStatus.published) {
      throw new BadRequestException('That one has already gone out.');
    }
    // Nothing is refunded for a `ready` post: the generation was made and is
    // theirs to download. Cancelling only stops it being published.
    const updated = await this.prisma.scheduledPost.update({
      where: { id },
      data: { status: ScheduledPostStatus.cancelled },
      include: { generation: { select: { outputUrl: true } } },
    });
    return PlannerService.view(updated);
  }

  /**
   * Starts generating everything due soon.
   *
   * Run on a schedule by the worker. Credits are charged here, at generation
   * time, exactly as they would be for a manual request — a planned post is not
   * a discount, it is a convenience.
   */
  async runDue(now = new Date()): Promise<{ started: number; failed: number }> {
    const due = await this.prisma.scheduledPost.findMany({
      where: {
        status: ScheduledPostStatus.planned,
        scheduledFor: { lte: new Date(now.getTime() + LEAD_TIME_MS) },
      },
      orderBy: { scheduledFor: 'asc' },
      take: 50,
    });

    let started = 0;
    let failed = 0;

    for (const post of due) {
      // Claim it first: two workers must never generate the same post twice,
      // which would charge the customer twice.
      const claimed = await this.prisma.scheduledPost.updateMany({
        where: { id: post.id, status: ScheduledPostStatus.planned },
        data: { status: ScheduledPostStatus.generating },
      });
      if (claimed.count === 0) continue;

      try {
        const result = await this.generations.submit({
          userId: post.userId,
          tierId: post.tierId,
          feature: 'PostPlanner',
          prompt: post.prompt,
        });
        await this.prisma.scheduledPost.update({
          where: { id: post.id },
          data: { generationId: result.generationId },
        });
        started++;
      } catch (error) {
        const message =
          error instanceof InsufficientCreditsError
            ? 'Not enough credits when this was due. Top up and reschedule it.'
            : 'This post could not be made. Your credits were not taken.';

        await this.prisma.scheduledPost.update({
          where: { id: post.id },
          data: { status: ScheduledPostStatus.failed, errorMessage: message },
        });
        failed++;
        this.logger.warn(`Scheduled post ${post.id} failed: ${(error as Error).message}`);
      }
    }

    if (started || failed) this.logger.log(`Post planner: ${started} started, ${failed} failed`);
    return { started, failed };
  }

  /**
   * Moves posts whose generation has finished to `ready`.
   *
   * Separate from `runDue` because generation is asynchronous: the post is due,
   * the render is in flight, and only later is there something to publish.
   */
  async settleGenerating(): Promise<{ ready: number; failed: number }> {
    const inFlight = await this.prisma.scheduledPost.findMany({
      where: { status: ScheduledPostStatus.generating, generationId: { not: null } },
      include: { generation: { select: { status: true, errorMessage: true } } },
      take: 100,
    });

    let ready = 0;
    let failed = 0;

    for (const post of inFlight) {
      if (post.generation?.status === GenerationStatus.completed) {
        await this.prisma.scheduledPost.update({
          where: { id: post.id },
          data: { status: ScheduledPostStatus.ready },
        });
        ready++;
      } else if (post.generation?.status === GenerationStatus.failed) {
        await this.prisma.scheduledPost.update({
          where: { id: post.id },
          data: {
            status: ScheduledPostStatus.failed,
            errorMessage: post.generation.errorMessage ?? 'This post could not be made.',
          },
        });
        failed++;
      }
    }

    return { ready, failed };
  }
}
