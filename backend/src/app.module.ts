import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { CreditsModule } from './credits/credits.module';
import { PaymentsModule } from './payments/payments.module';
import { PricingModule } from './pricing/pricing.module';
import { GenerationsModule } from './generations/generations.module';
import { QueueModule } from './queue/queue.module';
import { StorageModule } from './storage/storage.module';
import { HealthModule } from './health/health.module';
import { BrandModule } from './brand/brand.module';
import { PlannerModule } from './planner/planner.module';
import { MetricsModule } from './metrics/metrics.module';
import { VoiceModule } from './voice/voice.module';
import { StudioModule } from './generations/studio.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    CreditsModule,
    PaymentsModule,
    PricingModule,
    QueueModule,
    StorageModule,
    HealthModule,
    GenerationsModule,
    BrandModule,
    PlannerModule,
    MetricsModule,
    VoiceModule,
    // Must stay last. StudioModule holds the `POST /api/v1/:modelId` catch-all,
    // and Express matches in registration order — anything after it is shadowed.
    StudioModule,
  ],
})
export class AppModule {}
