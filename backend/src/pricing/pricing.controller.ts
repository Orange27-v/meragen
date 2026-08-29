import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { CatalogService } from './catalog.service';
import { AdminGuard } from '../common/admin.guard';

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

  /**
   * Pull the vendor rate card and report what moved. Scheduled in production.
   *
   * Owner-only. This rewrites the cost basis every price in the product derives
   * from, and it spends a vendor API call each time it runs — an open endpoint
   * would let a stranger move what we charge, or simply run up the bill.
   */
  @Post('pricing/sync')
  @UseGuards(AdminGuard)
  async sync() {
    return this.catalog.sync();
  }
}
