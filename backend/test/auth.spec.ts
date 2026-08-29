import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/common/prisma.service';
import { AuthService } from '../src/auth/auth.service';
import { FirebaseService, GoogleIdentity } from '../src/auth/firebase.service';

/** Stands in for Google. `staged` is whatever the token is taken to prove. */
class FakeFirebase extends FirebaseService {
  staged: GoogleIdentity | null = null;
  failure: Error | null = null;
  constructor() { super(new ConfigService()); }
  override get enabled(): boolean { return true; }
  override async verifyIdToken(): Promise<GoogleIdentity> {
    if (this.failure) throw this.failure;
    if (!this.staged) throw new Error('nothing staged');
    return this.staged;
  }
}

const prisma = new PrismaClient() as PrismaService;
const firebase = new FakeFirebase();
const auth = new AuthService(prisma, firebase, new ConfigService());

const email = () => `auth-${crypto.randomUUID()}@meerahstudio.com`;

const identity = (over: Partial<GoogleIdentity> = {}): GoogleIdentity => ({
  firebaseUid: `uid-${crypto.randomUUID()}`,
  email: email(),
  emailVerified: true,
  ...over,
});

beforeAll(async () => { await prisma.$connect(); });
afterAll(async () => { await prisma.$disconnect(); });

describe('signing in with Google', () => {
  it('creates the account on first sign-in', async () => {
    firebase.staged = identity();

    const result = await auth.continueWithGoogle('token');

    expect(result.user.email).toBe(firebase.staged.email);
    expect(result.user.creditBalance).toBe(0);
    expect(await auth.resolve(result.token)).toBe(result.user.id);

    const row = await prisma.user.findUniqueOrThrow({ where: { id: result.user.id } });
    expect(row.authProvider).toBe('google');
    expect(row.emailVerified).toBe(true);
    expect(row.firebaseUid).toBe(firebase.staged.firebaseUid);
  });

  it('returns the same account every time after that', async () => {
    firebase.staged = identity();

    const first = await auth.continueWithGoogle('t1');
    const second = await auth.continueWithGoogle('t2');

    expect(second.user.id).toBe(first.user.id);
    // A fresh session each time, so signing out on one device is possible.
    expect(second.token).not.toBe(first.token);
    expect(await prisma.user.count({ where: { email: firebase.staged.email } })).toBe(1);
  });

  it('adopts an account that already existed under the same email', async () => {
    // An account created before Google-only sign-in must be found and kept —
    // otherwise its paid credits are stranded in an unreachable account.
    const address = email();
    const legacy = await prisma.user.create({ data: { email: address } });
    await prisma.creditTransaction.create({
      data: { userId: legacy.id, type: 'topup', amount: 5000, balanceAfter: 5000, paystackRef: `legacy-${crypto.randomUUID()}` },
    });
    await prisma.user.update({ where: { id: legacy.id }, data: { creditBalance: 5000 } });

    firebase.staged = identity({ email: address });
    const result = await auth.continueWithGoogle('token');

    expect(result.user.id).toBe(legacy.id);
    expect(result.user.creditBalance).toBe(5000);
    expect(await prisma.user.count({ where: { email: address } })).toBe(1);
  });

  it('refuses a token Google will not vouch for', async () => {
    firebase.failure = new Error('bad signature');
    await expect(auth.continueWithGoogle('forged')).rejects.toThrow();
    firebase.failure = null;
  });

  it('has no password to store, check or leak', async () => {
    firebase.staged = identity();
    const result = await auth.continueWithGoogle('token');

    const row = await prisma.user.findUniqueOrThrow({ where: { id: result.user.id } });
    // The column is gone entirely, not merely unused.
    expect('passwordHash' in row).toBe(false);
    expect(Object.keys(auth)).not.toContain('login');
  });
});

describe('sessions', () => {
  it('rejects a junk or empty token', async () => {
    expect(await auth.resolve('')).toBeNull();
    expect(await auth.resolve('not-a-real-token')).toBeNull();
  });

  it('stores only a hash of the token, never the token', async () => {
    firebase.staged = identity();
    const result = await auth.continueWithGoogle('token');

    const sessions = await prisma.session.findMany({ where: { userId: result.user.id } });
    expect(sessions[0].tokenHash).not.toBe(result.token);
    expect(sessions[0].tokenHash).toHaveLength(64);
  });

  it('rejects an expired session and cleans it up', async () => {
    firebase.staged = identity();
    const result = await auth.continueWithGoogle('token');
    await prisma.session.updateMany({
      where: { userId: result.user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    expect(await auth.resolve(result.token)).toBeNull();
    expect(await prisma.session.count({ where: { userId: result.user.id } })).toBe(0);
  });

  it('stops working after logout', async () => {
    firebase.staged = identity();
    const result = await auth.continueWithGoogle('token');
    expect(await auth.resolve(result.token)).toBe(result.user.id);

    await auth.logout(result.token);
    expect(await auth.resolve(result.token)).toBeNull();
  });

  it('keeps two devices independent', async () => {
    firebase.staged = identity();
    const phone = await auth.continueWithGoogle('t1');
    const laptop = await auth.continueWithGoogle('t2');

    await auth.logout(phone.token);

    // Signing out on one device must not sign you out everywhere.
    expect(await auth.resolve(phone.token)).toBeNull();
    expect(await auth.resolve(laptop.token)).toBe(laptop.user.id);
  });
});
