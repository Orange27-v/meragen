import { Module } from '@nestjs/common';
import { PlannerService } from './planner.service';
import { SubscriptionService } from './subscription.service';
import { PlannerController } from './planner.controller';
import { GenerationsModule } from '../generations/generations.module';
import { CreditsModule } from '../credits/credits.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../common/prisma.service';

@Module({
  imports: [GenerationsModule, CreditsModule, AuthModule],
  controllers: [PlannerController],
  providers: [PlannerService, SubscriptionService, PrismaService],
  exports: [PlannerService, SubscriptionService],
})
export class PlannerModule {}
