import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminGuard } from '../common/admin.guard';
import { PricingService } from './pricing.service';
import { CatalogService } from './catalog.service';
import { PricingController } from './pricing.controller';
import { MuApiCatalogClient } from '../vendors/muapi.catalog';
import { PrismaService } from '../common/prisma.service';

@Module({
  imports: [AuthModule],
  controllers: [PricingController],
  providers: [PricingService, CatalogService, MuApiCatalogClient, PrismaService, AdminGuard],
  exports: [PricingService, CatalogService],
})
export class PricingModule {}
