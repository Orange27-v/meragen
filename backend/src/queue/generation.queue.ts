import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, JobsOptions } from 'bullmq';
import { GENERATION_QUEUE } from './queue.constants';

export interface GenerationJobData {
  generationId: string;
  /** When the job was first accepted, so the worker can enforce MAX_POLL_MS. */
  startedAt: number;
}

export function redisConnection(config: ConfigService): { url: string } {
  return { url: config.get<string>('REDIS_URL', 'redis://localhost:6379') };
}

@Injectable()
export class GenerationQueue implements OnModuleDestroy {
  private readonly logger = new Logger(GenerationQueue.name);
  readonly queue: Queue<GenerationJobData>;

  constructor(config: ConfigService) {
    this.queue = new Queue<GenerationJobData>(GENERATION_QUEUE, {
      connection: redisConnection(config),
      defaultJobOptions: {
        // Transient vendor errors get a few goes; permanent ones are settled by
        // the processor without ever throwing, so they never retry.
        attempts: 4,
        backoff: { type: 'exponential', delay: 3_000 },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 24 * 3600 },
      },
    });
  }

  /** Hand a freshly submitted generation to the workers. */
  async enqueue(generationId: string, options?: JobsOptions): Promise<void> {
    await this.queue.add(
      'poll',
      { generationId, startedAt: Date.now() },
      { jobId: `gen-${generationId}`, ...options },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
