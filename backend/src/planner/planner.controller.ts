import {
  Controller, Get, Post, Delete, Body, Param, Query, Req, UseGuards, HttpCode, BadRequestException,
} from '@nestjs/common';
import { PostPlatform } from '@prisma/client';
import { AuthGuard, AuthedRequest } from '../auth/auth.guard';
import { PlannerService } from './planner.service';
import { SubscriptionService, PLANNER_MONTHLY_CREDITS } from './subscription.service';
import { NAIRA_PER_CREDIT } from '../pricing/money';

@Controller('api/v1/planner')
@UseGuards(AuthGuard)
export class PlannerController {
  constructor(
    private readonly planner: PlannerService,
    private readonly subscription: SubscriptionService,
  ) {}

  /** The calendar, plus whether the add-on is switched on. */
  @Get()
  async list(
    @Req() req: AuthedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const [posts, plan] = await Promise.all([
      this.planner.list(
        req.userId!,
        from ? new Date(from) : undefined,
        to ? new Date(to) : undefined,
      ),
      this.subscription.get(req.userId!),
    ]);
    return { posts, subscription: plan };
  }

  @Post()
  @HttpCode(200)
  async schedule(
    @Req() req: AuthedRequest,
    @Body() body: { scheduledFor?: string; tierId?: string; prompt?: string; caption?: string; platform?: string },
  ) {
    // Gated on the add-on: this is the second revenue line, not a free extra.
    if (!(await this.subscription.isActive(req.userId!))) {
      throw new BadRequestException({
        error: 'planner_not_active',
        message: `Switch on Post Planner to schedule posts — ${PLANNER_MONTHLY_CREDITS} credits a month (₦${(PLANNER_MONTHLY_CREDITS * NAIRA_PER_CREDIT).toLocaleString()}).`,
      });
    }

    if (!body?.scheduledFor) throw new BadRequestException('scheduledFor is required');
    if (!body?.tierId) throw new BadRequestException('tierId is required');

    // v1 is manual-only, deliberately. Direct publishing needs Meta App Review
    // and Business Manager verification — two external approval queues with
    // timelines we do not control, and blocking launch on someone else's queue
    // burns runway with no revenue. The enum and the job architecture already
    // allow for it, so v2 slots in without a rebuild; until then we refuse the
    // option rather than accept it and silently never publish.
    if (body.platform && body.platform !== PostPlatform.manual) {
      throw new BadRequestException({
        error: 'publishing_not_available',
        message:
          'Direct posting to Instagram and Facebook is not available yet. Your post will be generated on schedule and waiting in your library to upload.',
      });
    }
    const platform = PostPlatform.manual;

    return this.planner.schedule({
      userId: req.userId!,
      scheduledFor: new Date(body.scheduledFor),
      tierId: body.tierId,
      prompt: body.prompt ?? '',
      caption: body.caption,
      platform,
    });
  }

  @Delete(':id')
  async cancel(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.planner.cancel(req.userId!, id);
  }

  /** Switch the add-on on. Charges the first month straight away. */
  @Post('subscribe')
  @HttpCode(200)
  async subscribe(@Req() req: AuthedRequest) {
    return this.subscription.start(req.userId!);
  }

  /** Off immediately, no notice period. */
  @Post('unsubscribe')
  @HttpCode(200)
  async unsubscribe(@Req() req: AuthedRequest) {
    return this.subscription.stop(req.userId!);
  }
}
