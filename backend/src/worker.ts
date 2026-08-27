import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import { AppModule } from './app.module';
import { GenerationProcessor } from './queue/generation.processor';
import { GenerationPoller } from './queue/generation.poller';
import { PaymentsService } from './payments/payments.service';
import { PlannerService } from './planner/planner.service';
import { SubscriptionService } from './planner/subscription.service';
import { GenerationJobData, redisConnection } from './queue/generation.queue';
import { GENERATION_QUEUE } from './queue/queue.constants';

/**
 * The second entry point — `npm run worker:dev`.
 *
 * Same codebase as the API, different process.
 *
 * Runs separately from the API so generation load never slows down signups,
 * top-ups or page loads, and so it can be scaled on its own (planning.md §5).
 *
 * Two mechanisms, deliberately:
 *   - the BullMQ worker gives a newly submitted job its first status check
 *     immediately, so quick renders feel quick;
 *   - the sweeper then chases every unfinished job to a conclusion from the
 *     database, so nothing is abandoned if a process dies or Redis is cleared.
 */
const SWEEP_INTERVAL_MS = 2_000;
const RECONCILE_INTERVAL_MS = 5 * 60_000;
const PLANNER_INTERVAL_MS = 60_000;
const RENEWAL_INTERVAL_MS = 60 * 60_000;

async function bootstrap(): Promise<void> {
  const logger = new Logger('Worker');
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: false });

  const processor = app.get(GenerationProcessor);
  const poller = app.get(GenerationPoller);
  const config = app.get(ConfigService);
  const concurrency = Number(config.get<string>('WORKER_CONCURRENCY', '10'));

  const worker = new Worker<GenerationJobData>(
    GENERATION_QUEUE,
    async (job) => processor.process(job.data),
    { connection: redisConnection(config), concurrency },
  );
  worker.on('failed', (job, error) => logger.error(`Job ${job?.id} failed: ${error.message}`));

  const sweep = setInterval(() => {
    void poller.sweep().catch((error) => logger.error(`Sweep error: ${error.message}`));
  }, SWEEP_INTERVAL_MS);

  // Backstop for payments no other route credited — see
  // PaymentsService.reconcile. Cheap, and the failure it catches is someone
  // being out of pocket.
  const payments = app.get(PaymentsService);
  const reconcile = setInterval(() => {
    void payments.reconcile().catch((error) => logger.error(`Reconcile error: ${error.message}`));
  }, RECONCILE_INTERVAL_MS);
  void payments.reconcile().catch(() => undefined);

  // Content calendar: start what is due, and move finished renders to ready.
  const planner = app.get(PlannerService);
  const plannerTick = setInterval(() => {
    void planner.runDue()
      .then(() => planner.settleGenerating())
      .catch((error) => logger.error(`Planner error: ${error.message}`));
  }, PLANNER_INTERVAL_MS);

  // Monthly add-on renewals, charged in credits.
  const subscriptions = app.get(SubscriptionService);
  const renewalTick = setInterval(() => {
    void subscriptions.renewDue().catch((error) => logger.error(`Renewal error: ${error.message}`));
  }, RENEWAL_INTERVAL_MS);

  logger.log(
    `Worker running — generations (concurrency ${concurrency}, sweep ${SWEEP_INTERVAL_MS}ms), ` +
      `payments every ${RECONCILE_INTERVAL_MS / 60000}min, ` +
      `planner every ${PLANNER_INTERVAL_MS / 1000}s, renewals hourly`,
  );

  const shutdown = async (signal: string): Promise<void> => {
    logger.log(`${signal} received — finishing in-flight jobs`);
    clearInterval(sweep);
    clearInterval(reconcile);
    clearInterval(plannerTick);
    clearInterval(renewalTick);
    await worker.close();
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

void bootstrap();
