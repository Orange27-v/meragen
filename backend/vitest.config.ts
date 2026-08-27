import { defineConfig } from 'vitest/config';
import { config as loadEnv } from 'dotenv';

// Point every test at the dedicated test database before anything connects.
loadEnv({ path: '.env.test', override: true });

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.spec.ts', 'src/**/*.spec.ts'],
    // Ledger concurrency tests hit a real Postgres and need room to run.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: 'forks',
    // One shared Postgres: files must not run concurrently or they clobber
    // each other's fixture rows.
    fileParallelism: false,
  },
});
