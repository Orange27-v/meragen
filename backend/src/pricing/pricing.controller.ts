import { Controller, Get, Post, Param } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { CatalogService } from './catalog.service';

@Controller('api/v1')
export class PricingController {
  constructor(
    private readonly pricing: PricingService,
    private readonly catalog: CatalogService,
  ) {}

  /** The price list. Only tiers we are willing to honour appear in `sellable`. */
  @Get('pricing')
  async list() {
    const { sellable, blocked } = await this.pricing.quoteAll();
    return {
      nairaPerUsd: this.pricing.nairaPerUsd,
      marginFloor: this.pricing.marginFloor,
      tiers: sellable,
      unavailable: blocked,
    };
  }

  /** Live quote for one tier — what the studio calls as options change. */
  @Get('pricing/:tierId')
  async quote(@Param('tierId') tierId: string) {
    return this.pricing.quote(tierId);
  }

  /** Pull the vendor rate card and report what moved. Scheduled in production. */
  @Post('pricing/sync')
  async sync() {
    return this.catalog.sync();
  }
}
