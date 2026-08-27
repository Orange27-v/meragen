import { Injectable, Logger } from '@nestjs/common';
import { GenerationStatus } from '@prisma/client';
import { GenerationsService } from '../generations/generations.service';
import { GenerationJobData } from './generation.queue';
import { MAX_POLL_MS } from './queue.constants';

/**
 * Gives a freshly submitted generation its first status check, straight away.
 *
 * Deliberately does exactly one check and returns. Follow-up polling belongs to
 * GenerationPoller, which sweeps the database — that survives a worker crash,
 * whereas a job holding a worker in a polling loop does not.
 */
@Injectable()
export class GenerationProcessor {
  private readonly logger = new Logger(GenerationProcessor.name);

  constructor(private readonly generations: GenerationsService) {}

  async process(data: GenerationJobData): Promise<{ done: boolean; status: GenerationStatus }> {
    const elapsed = Date.now() - data.startedAt;

    if (elapsed > MAX_POLL_MS) {
      // Vendor never came back. Treat as failed so the customer is refunded
      // rather than left with credits gone and nothing to show.
      this.logger.error(`Generation ${data.generationId} timed out after ${Math.round(elapsed / 1000)}s`);
      await this.generations.failTimedOut(data.generationId);
      return { done: true, status: GenerationStatus.failed };
    }

    // `refresh` handles settlement and refunds; a transient vendor blip leaves
    // the job in `processing` rather than throwing, so we simply ask again.
    const result = await this.generations.refresh(data.generationId);

    if (result.status === GenerationStatus.processing || result.status === GenerationStatus.queued) {
      // Still rendering. The sweeper takes it from here.
      return { done: false, status: result.status };
    }

    this.logger.log(
      `Generation ${data.generationId} ${result.status} after ${Math.round(elapsed / 1000)}s`,
    );
    return { done: true, status: result.status };
  }
}
