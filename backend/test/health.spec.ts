import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/common/prisma.service';
import { HealthService, Health } from '../src/health/health.service';
import { FirebaseService } from '../src/auth/firebase.service';
import { StorageService } from '../src/storage/storage.service';

const prisma = new PrismaClient() as PrismaService;

class TestConfig extends ConfigService {
  values: Record<string, string> = { PAYSTACK_SECRET_KEY: 'sk_test_x', MUAPI_KEY: 'x' };
  override get<T>(key: string, fallback?: T): T { return (this.values[key] ?? fallback) as T; }
}

class FakeFirebase { constructor(public enabled: boolean) {} }
class FakeStorage { constructor(public backendName: string) {} }

function build(over: { firebase?: boolean; storage?: string; config?: Record<string, string> } = {}) {
  const config = new TestConfig();
  Object.assign(config.values, over.config ?? {});
  return new HealthService(
    prisma,
    config,
    new FakeFirebase(over.firebase ?? true) as unknown as FirebaseService,
    new FakeStorage(over.storage ?? 'r2') as unknown as StorageService,
  );
}

const find = (health: Health, name: string) => health.checks.find((c) => c.name === name)!;

beforeAll(async () => { await prisma.$connect(); });
afterAll(async () => { await prisma.$disconnect(); });

describe('health', () => {
  it('reports ok when everything is configured', async () => {
    const health = await build({ config: { PAYSTACK_SECRET_KEY: 'sk_live_x' } }).check();

    expect(health.status).toBe('ok');
    expect(find(health, 'database').state).toBe('ok');
    expect(find(health, 'sign-in').state).toBe('ok');
  });

  it('goes fully down when nobody can sign in', async () => {
    // The whole reason this check exists: Google is the only way in, so a
    // missing Firebase key means the platform is unusable, not degraded.
    const health = await build({ firebase: false }).check();

    expect(health.status).toBe('down');
    expect(find(health, 'sign-in').state).toBe('down');
    expect(find(health, 'sign-in').critical).toBe(true);
    expect(find(health, 'sign-in').detail).toContain('NOBODY CAN SIGN IN');
  });

  it('goes down when nobody can pay', async () => {
    const health = await build({ config: { PAYSTACK_SECRET_KEY: '' } }).check();

    expect(health.status).toBe('down');
    expect(find(health, 'payments').state).toBe('down');
  });

  it('flags test-mode payments without calling the platform broken', async () => {
    const health = await build().check();

    expect(find(health, 'payments').state).toBe('degraded');
    expect(health.status).toBe('degraded');
  });

  it('treats a missing generation key as serious but not fatal', async () => {
    // People can still sign in and buy credits; generations refund themselves.
    const health = await build({ config: { MUAPI_KEY: '', PAYSTACK_SECRET_KEY: 'sk_live_x' } }).check();

    expect(find(health, 'generation').state).toBe('down');
    expect(find(health, 'generation').critical).toBe(false);
    expect(health.status).toBe('degraded');
  });

  it('warns that local disk storage will lose files in production', async () => {
    const health = await build({ storage: 'local', config: { PAYSTACK_SECRET_KEY: 'sk_live_x' } }).check();

    expect(find(health, 'storage').state).toBe('degraded');
    expect(health.status).toBe('degraded');
  });
});
