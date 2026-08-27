import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PaystackClient } from './paystack.client';
import { CreditsModule } from '../credits/credits.module';
import { PrismaService } from '../common/prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [CreditsModule, AuthModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaystackClient, PrismaService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
