import {
  Controller, Post, Get, Body, Req, Headers, HttpCode, UseGuards, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard, AuthedRequest } from '../auth/auth.guard';
import { PaymentsService } from './payments.service';
import { PaystackClient } from './paystack.client';
import { CREDIT_PACKS, nairaFromKobo, PAYG_MIN_NAIRA, PAYG_MAX_NAIRA, validatePaygAmount } from './credit-packs';
import { paystackFeeKobo, netAfterPaystackKobo } from '../pricing/infrastructure';

@Controller()
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly paystack: PaystackClient,
  ) {}

  /**
   * What the top-up page shows.
   *
   * `net` is what actually reaches the business account after Paystack's cut —
   * shown so the margin in the pricing table is the real one, not the sticker
   * price (planning.md §6).
   */
  @Get('api/v1/credit-packs')
  listPacks() {
    return {
      packs: CREDIT_PACKS.map((pack) => ({
        id: pack.id,
        name: pack.name,
        naira: nairaFromKobo(pack.amountKobo),
        credits: pack.credits,
        bonusCredits: pack.bonusCredits,
        /** Extra credits per Naira versus paying as you go. */
        bonusPercent: Number(((pack.bonusCredits / (pack.credits - pack.bonusCredits)) * 100).toFixed(1)),
        paystackFee: nairaFromKobo(paystackFeeKobo(pack.amountKobo)),
        net: nairaFromKobo(netAfterPaystackKobo(pack.amountKobo)),
      })),
      payg: {
        minNaira: PAYG_MIN_NAIRA,
        maxNaira: PAYG_MAX_NAIRA,
        creditsPerNaira: 1,
      },
    };
  }

  /** Start a top-up. Returns the Paystack checkout URL to redirect to. */
  @Post('api/v1/topup')
  @UseGuards(AuthGuard)
  async startTopup(
    @Req() req: AuthedRequest,
    @Body() body: { packId?: string; amountNaira?: number; callbackUrl?: string },
  ) {
    if (!body?.packId && body?.amountNaira === undefined) {
      throw new BadRequestException('Choose a pack or enter an amount.');
    }

    // Pay as you go: validate here so the customer gets a useful message rather
    // than a generic "unknown pack".
    if (!body.packId) {
      const invalid = validatePaygAmount(Number(body.amountNaira));
      if (invalid) throw new BadRequestException(invalid.message);
    }

    return this.payments.startTopup({
      userId: req.userId!,
      packId: body.packId,
      amountNaira: body.amountNaira === undefined ? undefined : Number(body.amountNaira),
      callbackUrl: body.callbackUrl,
    });
  }

  /**
   * Called by the browser when it returns from checkout.
   *
   * The webhook is still the primary route; this covers the case where it
   * cannot reach us — during local development it always will, and in
   * production a webhook can be delayed or lost.
   */
  @Post('api/v1/topup/verify')
  @UseGuards(AuthGuard)
  @HttpCode(200)
  async verify(@Req() req: AuthedRequest, @Body() body: { reference?: string }) {
    if (!body?.reference) throw new BadRequestException('reference is required');
    return this.payments.verifyForUser(req.userId!, body.reference);
  }

  /**
   * Paystack calls this when money lands.
   *
   * Always answers 200, even for events we ignore — a non-200 makes Paystack
   * retry the same event for hours. Whether we acted is in the body.
   */
  @Post('webhooks/paystack')
  @HttpCode(200)
  async webhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-paystack-signature') signature: string | undefined,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody) throw new BadRequestException('Raw body unavailable');

    if (!this.paystack.verifyWebhookSignature(rawBody, signature)) {
      // Not from Paystack. 403 here is correct — we want these to stop.
      throw new ForbiddenException('Invalid signature');
    }

    return this.payments.handleWebhook(JSON.parse(rawBody.toString('utf8')));
  }
}
