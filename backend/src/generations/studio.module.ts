import { Module } from '@nestjs/common';
import { StudioController } from './studio.controller';
import { GenerationsModule } from './generations.module';
import { PricingModule } from '../pricing/pricing.module';
import { CreditsModule } from '../credits/credits.module';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { PrismaService } from '../common/prisma.service';

/**
 * Holds the `POST /api/v1/:modelId` catch-all, alone and on purpose.
 *
 * Express matches routes in registration order, so this module must be the very
 * last import in AppModule — and nothing else may import it, or it gets pulled
 * in early and starts shadowing real endpoints. That is exactly how
 * /api/v1/brand broke.
 */
@Module({
  imports: [GenerationsModule, PricingModule, CreditsModule, AuthModule, StorageModule],
  controllers: [StudioController],
  providers: [PrismaService],
})
export class StudioModule {}
