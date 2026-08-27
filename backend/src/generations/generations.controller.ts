import {
  Controller, Post, Get, Body, Param, Req, UseGuards,
  BadRequestException, ServiceUnavailableException,
} from '@nestjs/common';
import { AuthGuard, AuthedRequest } from '../auth/auth.guard';
import { GenerationsService } from './generations.service';
import { InsufficientCreditsError } from '../credits/credits.errors';
import { UnpricedModelError, MarginFloorBreachError } from '../pricing/pricing.errors';
import { VendorError } from '../vendors/vendor.types';

@Controller('api/v1')
export class GenerationsController {
  constructor(private readonly generations: GenerationsService) {}

  /** Start a generation. Returns immediately — the job runs in the background. */
  @Post('generate')
  @UseGuards(AuthGuard)
  async generate(
    @Req() req: AuthedRequest,
    @Body() body: { tierId?: string; feature?: string; prompt?: string; options?: Record<string, unknown> },
  ) {
    if (!body?.tierId) throw new BadRequestException('tierId is required');

    try {
      return await this.generations.submit({
        userId: req.userId!,
        tierId: body.tierId,
        feature: body.feature ?? 'VidEngine',
        prompt: body.prompt,
        options: body.options,
      });
    } catch (error) {
      if (error instanceof UnpricedModelError || error instanceof MarginFloorBreachError) {
        // We cannot price this right now, so we will not start work we cannot
        // cost. Say so plainly rather than returning a 500.
        throw new ServiceUnavailableException({
          error: 'tier_unavailable',
          message: 'That quality is temporarily unavailable. Try another one.',
        });
      }
      if (error instanceof VendorError) {
        // The generator refused the job. It has already been refunded inside
        // GenerationsService — tell the customer plainly, never a 500.
        throw new BadRequestException({
          error: 'generation_failed',
          message: error.userMessage,
          refunded: true,
        });
      }
      if (error instanceof InsufficientCreditsError) {
        throw new BadRequestException({
          error: 'insufficient_credits',
          message: 'Not enough credits. Top up to continue.',
          required: error.required,
          available: error.available,
        });
      }
      throw error;
    }
  }

  /** Poll for a result. Safe to call as often as the client likes. */
  @Get('generations/:id')
  @UseGuards(AuthGuard)
  async status(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.generations.refresh(id, req.userId!);
  }

  /**
   * The shape the forked studio already speaks.
   *
   * Keeping this contract is the whole reason the frontend fork is cheap
   * (planning.md §4) — the studio components poll this path and read
   * `outputs[0]` and `cost.refunded` without knowing anything changed.
   */
  @Get('predictions/:id/result')
  @UseGuards(AuthGuard)
  async predictionResult(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.generations.resultForClient(id, req.userId!);
  }
}
