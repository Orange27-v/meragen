import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /**
   * Unauthenticated on purpose so an uptime monitor can read it.
   *
   * Returns 503 when something critical is down, so a monitor alerts on the
   * status code without having to parse the body.
   */
  @Get()
  async check(@Res() res: Response): Promise<void> {
    const health = await this.health.check();
    res.status(health.status === 'down' ? 503 : 200).json(health);
  }
}
