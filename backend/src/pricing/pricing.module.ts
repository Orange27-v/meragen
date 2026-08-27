import { Module } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { CatalogService } from './catalog.service';
import { PricingController } from './pricing.controller';
import { MuApiCatalogClient } from '../vendors/muapi.catalog';
import { PrismaService } from '../common/prisma.service';

@Module({
  controllers: [PricingController],
  providers: [PricingService, CatalogService, MuApiCatalogClient, PrismaService],
  exports: [PricingService, CatalogService],
})
export class PricingModule {}
