import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { CatalogService } from './catalog.service';
import { AdminGuard } from '../common/admin.guard';
import { AuthGuard } from '../auth/auth.guard';

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

  /**
   * The whole sellable catalogue, grouped and priced.
   *
   * Signed-in only. This is the one place a customer meets a vendor model name,
   * and it is opt-in — the Advanced drawer inside a studio. Everywhere else
   * they see a quality tier.
   */
  @Get('models')
  @UseGuards(AuthGuard)
  async models() {
    return this.pricing.listModels();
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
