import {
  Controller, Post, Get, Body, Param, Query, Req, UseGuards, HttpCode,
  UseInterceptors, UploadedFile,
  BadRequestException, NotFoundException, ServiceUnavailableException,
} from '@nestjs/common';
import { AuthGuard, AuthedRequest } from '../auth/auth.guard';
import { GenerationsService } from './generations.service';
import { PricingService } from '../pricing/pricing.service';
import { CreditsService } from '../credits/credits.service';
import { InsufficientCreditsError } from '../credits/credits.errors';
import { UnpricedModelError, MarginFloorBreachError } from '../pricing/pricing.errors';
import { VendorError } from '../vendors/vendor.types';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService } from '../storage/storage.service';
import { PrismaService } from '../common/prisma.service';
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from '../storage/storage.types';

/**
 * The MuAPI-shaped surface the forked studio components already speak.
 *
 * `POST /api/v1/{model}` -> `{ request_id }`, then poll
 * `GET /api/v1/predictions/{id}/result`. Matching this contract is what makes
 * the frontend fork nearly free (planning.md §4): the studio keeps its own
 * model catalogue and controls, and simply talks to us instead of MuAPI.
 *
 * Paths that belong to our own API and must never be read as a model name.
 *
 * Two defences, because getting this wrong silently breaks a real endpoint:
 * this list, and registering this module last in AppModule so its `:modelId`
 * route cannot shadow a real one. A missing entry here is caught by the
 * reserved-path test in studio.spec.ts — add the prefix whenever a new
 * controller mounts under /api/v1.
 */
const RESERVED = new Set([
  'auth', 'generate', 'generations', 'predictions', 'pricing', 'topup',
  'credit-packs', 'account', 'history', 'models', 'app', 'upload_file',
  'brand', 'planner', 'metrics', 'voice',
]);

@Controller('api/v1')
export class StudioController {
  constructor(
    private readonly generations: GenerationsService,
    private readonly pricing: PricingService,
    private readonly credits: CreditsService,
    private readonly storage: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  /** Balance, in the shape the studio's header widget reads. */
  @Get('account/balance')
  @UseGuards(AuthGuard)
  async balance(@Req() req: AuthedRequest) {
    return { balance: await this.credits.getBalance(req.userId!) };
  }

  /** Live price for any model — drives the studio's cost display. */
  @Get('models/:modelId/estimate-cost')
  @UseGuards(AuthGuard)
  async estimate(@Param('modelId') modelId: string) {
    try {
      const quote = await this.pricing.quoteModel(modelId);
      return { cost: quote.credits, credits: quote.credits, naira: quote.naira };
    } catch (error) {
      if (error instanceof UnpricedModelError) throw new NotFoundException('Unknown model');
      throw error;
    }
  }

  /** Past generations, newest first. Shape matches what the studio renders. */
  @Get('history')
  @UseGuards(AuthGuard)
  async history(@Req() req: AuthedRequest, @Query('limit') limit?: string) {
    const rows = await this.generations.history(req.userId!, Number(limit) || 50);
    return {
      items: rows.map((row) => {
        const params = (row.inputParams ?? {}) as Record<string, unknown>;
        return {
          request_id: row.id,
          // The quality the customer chose, never the vendor's model id. The
          // history cards render this straight onto the page, so putting
          // `seedance-pro-t2v-fast` here would publish our supplier list.
          quality: this.pricing.tierLabelForModel(row.modelId),
          feature: row.feature,
          status: row.status,
          prompt: typeof params.prompt === 'string' ? params.prompt : '',
          duration: typeof params.duration === 'number' ? params.duration : undefined,
          outputs: row.outputUrl ? [row.outputUrl] : [],
          cost: { amount_credits: row.costCredits },
          created_at: row.createdAt,
        };
      }),
      // No cursor yet: 100 rows covers every real session, and paging can be
      // added when someone actually has more history than that.
      cursor: null,
    };
  }

  /**
   * Live cost for a model plus its chosen options.
   *
   * The studio calls this as the user changes resolution or duration, so the
   * displayed price always comes from the server — the browser never computes
   * what it will be charged (planning.md §2.2).
   */
  @Post('app/calculate_dynamic_cost')
  @UseGuards(AuthGuard)
  @HttpCode(200)
  async dynamicCost(@Body() body: { task_name?: string; payload?: Record<string, unknown> }) {
    const modelId = body?.task_name;
    if (!modelId) throw new BadRequestException('task_name is required');
    try {
      const quote = await this.pricing.quoteModel(modelId);
      return { cost: quote.credits, credits: quote.credits, naira: quote.naira };
    } catch (error) {
      if (error instanceof UnpricedModelError) throw new NotFoundException('Unknown model');
      if (error instanceof MarginFloorBreachError) {
        throw new ServiceUnavailableException({ error: 'model_unavailable', message: 'That model is temporarily unavailable.' });
      }
      throw error;
    }
  }

  /**
   * Which not-yet-built tools a customer wants.
   *
   * Cheap, and it turns "what should we build next" from a guess into a count.
   */
  @Post('app/interest')
  @UseGuards(AuthGuard)
  @HttpCode(200)
  async registerInterest(@Req() req: AuthedRequest, @Body() body: { app_name?: string }) {
    if (!body?.app_name) throw new BadRequestException('app_name is required');
    await this.prisma.appInterest.upsert({
      where: { userId_appName: { userId: req.userId!, appName: body.app_name } },
      create: { userId: req.userId!, appName: body.app_name },
      update: {},
    });
    return { ok: true, app_name: body.app_name };
  }

  @Get('app/interests')
  @UseGuards(AuthGuard)
  async listInterests(@Req() req: AuthedRequest) {
    const rows = await this.prisma.appInterest.findMany({
      where: { userId: req.userId! },
      select: { appName: true },
    });
    return { interests: rows.map((row) => row.appName) };
  }

  /**
   * Uploads for image-to-video, lip-sync and reference images.
   *
   * The studio posts multipart and reads `url` off the response. Stored files
   * are served through signed, time-limited URLs — never a permanent public
   * link (planning.md §8).
   */
  @Post('upload_file')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  @HttpCode(200)
  async uploadFile(@Req() req: AuthedRequest, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file was uploaded.');

    const contentType = file.mimetype?.split(';')[0] ?? '';
    if (!ALLOWED_UPLOAD_TYPES.has(contentType)) {
      throw new BadRequestException(
        'That file type is not supported. Use a JPG, PNG, WEBP, MP4, MOV or MP3.',
      );
    }

    const stored = await this.storage.putUpload(req.userId!, file.buffer, contentType);
    // `url` is the field the studio reads; the rest is for our own debugging.
    return { url: stored.url, key: stored.key, bytes: file.size, content_type: contentType };
  }

  /**
   * Submit a generation against any catalogue model.
   *
   * Deliberately last: `:modelId` would otherwise swallow the routes above.
   */
  @Post(':modelId')
  @UseGuards(AuthGuard)
  @HttpCode(200)
  async submit(
    @Req() req: AuthedRequest,
    @Param('modelId') modelId: string,
    @Body() body: Record<string, unknown>,
  ) {
    if (RESERVED.has(modelId)) throw new NotFoundException();

    const { prompt, ...options } = body ?? {};

    try {
      const result = await this.generations.submit({
        userId: req.userId!,
        tierId: modelId,
        feature: 'Studio',
        prompt: typeof prompt === 'string' ? prompt : undefined,
        options: options as Record<string, unknown>,
      });
      // The studio reads `request_id` off this response and starts polling.
      return { request_id: result.generationId, cost: { amount_credits: result.costCredits } };
    } catch (error) {
      if (error instanceof UnpricedModelError) throw new NotFoundException('Unknown model');
      if (error instanceof MarginFloorBreachError) {
        throw new ServiceUnavailableException({ error: 'model_unavailable', message: 'That model is temporarily unavailable.' });
      }
      if (error instanceof VendorError) {
        throw new BadRequestException({ error: 'generation_failed', message: error.userMessage, refunded: true });
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
}
