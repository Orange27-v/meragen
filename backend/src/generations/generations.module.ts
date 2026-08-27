import { Module } from '@nestjs/common';
import { GenerationsService } from './generations.service';
import { GenerationsController } from './generations.controller';
import { MuApiVendor } from '../vendors/muapi.vendor';
import { CreditsModule } from '../credits/credits.module';
import { PricingModule } from '../pricing/pricing.module';
import { PrismaService } from '../common/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { GenerationQueue } from '../queue/generation.queue';

@Module({
  imports: [CreditsModule, PricingModule, AuthModule, StorageModule],
  controllers: [GenerationsController],
  providers: [GenerationsService, MuApiVendor, PrismaService, GenerationQueue],
  exports: [GenerationsService, GenerationQueue, CreditsModule, PricingModule, StorageModule],
})
export class GenerationsModule {}
