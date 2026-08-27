import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { AdminGuard } from './admin.guard';

@Controller('api/v1/metrics')
@UseGuards(AdminGuard)
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  async summary(@Query('days') days?: string) {
    const window = Math.min(Math.max(Number(days) || 30, 1), 365);
    const [metrics, daily] = await Promise.all([
      this.metrics.collect(window),
      this.metrics.daily(window),
    ]);
    return { ...metrics, daily };
  }
}
