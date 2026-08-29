import { Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { AdminGuard } from '../common/admin.guard';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../common/prisma.service';

@Module({
  imports: [AuthModule],
  controllers: [MetricsController],
  providers: [MetricsService, AdminGuard, PrismaService],
  exports: [MetricsService],
})
export class MetricsModule {}
