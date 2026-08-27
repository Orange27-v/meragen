/**
 * The API's entry point — `npm run dev` starts here.
 *
 * This project owns everything that touches money, vendors or the database. The
 * website (`../meerah`) holds none of it and reaches this over HTTP; its own
 * entry to the API is `meerah/lib/api.ts`.
 *
 * The generation worker starts from `worker.ts` instead — same codebase, second
 * process, so render load never slows down signups or top-ups.
 *
 * Routes are declared by the controllers in each module, not registered here.
 * Module order in `app.module.ts` matters for exactly one reason, noted there.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { HealthService } from './health/health.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    // Paystack signs the raw bytes, so we need them intact — any reformatting
    // by a JSON parser would break signature verification.
    rawBody: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  new Logger('Bootstrap').log(`Meerah API listening on http://localhost:${port}`);

  // Say plainly what is and is not working. Sign-in is Google-only, so a
  // missing Firebase key means nobody can get in — that must not be something
  // you discover from a customer.
  await app.get(HealthService).report();
}

void bootstrap();
