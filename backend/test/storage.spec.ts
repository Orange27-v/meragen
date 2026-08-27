import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import { LocalStorage } from '../src/storage/local.storage';
import { R2Storage } from '../src/storage/r2.storage';
import { StorageService, STORAGE } from '../src/storage/storage.service';
import { ALLOWED_UPLOAD_TYPES } from '../src/storage/storage.types';

const ROOT = resolve('./.storage-test');

class TestConfig extends ConfigService {
  values: Record<string, string> = {
    LOCAL_STORAGE_DIR: ROOT,
    SESSION_SECRET: 'test-secret',
    API_PUBLIC_URL: 'http://localhost:3001',
  };
  override get<T>(key: string, fallback?: T): T { return (this.values[key] ?? fallback) as T; }
}

const config = new TestConfig();
const local = new LocalStorage(config);
const service = new StorageService(local, config);

afterAll(async () => { await fs.rm(ROOT, { recursive: true, force: true }); });

describe('signed URLs', () => {
  it('round-trips a stored file', async () => {
    await local.put('uploads/u1/pic.png', Buffer.from('hello'), 'image/png');
    const found = await local.get('uploads/u1/pic.png');

    expect(found?.body.toString()).toBe('hello');
    expect(found?.contentType).toBe('image/png');
  });

  it('accepts a valid signature and rejects a forged one', async () => {
    const url = await local.signedUrl('uploads/u1/pic.png', 60);
    const parsed = new URL(url);
    const expires = Number(parsed.searchParams.get('expires'));
    const sig = parsed.searchParams.get('sig')!;

    expect(local.verify('uploads/u1/pic.png', expires, sig)).toBe(true);
    expect(local.verify('uploads/u1/pic.png', expires, 'deadbeef')).toBe(false);
    // A signature is bound to its key — it cannot be reused for another file.
    expect(local.verify('uploads/someone-else/private.png', expires, sig)).toBe(false);
  });

  it('rejects an expired link', async () => {
    const url = await local.signedUrl('uploads/u1/pic.png', -10);
    const parsed = new URL(url);
    expect(
      local.verify('uploads/u1/pic.png', Number(parsed.searchParams.get('expires')), parsed.searchParams.get('sig')!),
    ).toBe(false);
  });

  it('refuses a key that tries to escape the storage directory', async () => {
    await expect(local.put('../../etc/passwd', Buffer.from('x'), 'image/png')).rejects.toThrow(/Invalid storage key/);
  });
});

describe('uploads', () => {
  it('keeps each customer\'s uploads under their own prefix', async () => {
    const a = await service.putUpload('user-a', Buffer.from('a'), 'image/png');
    const b = await service.putUpload('user-b', Buffer.from('b'), 'image/png');

    expect(a.key.startsWith('uploads/user-a/')).toBe(true);
    expect(b.key.startsWith('uploads/user-b/')).toBe(true);
    expect(a.key).not.toBe(b.key);
  });

  it('gives files the right extension for their type', async () => {
    const video = await service.putUpload('user-a', Buffer.from('v'), 'video/mp4');
    const audio = await service.putUpload('user-a', Buffer.from('a'), 'audio/mpeg');

    expect(video.key.endsWith('.mp4')).toBe(true);
    expect(audio.key.endsWith('.mp3')).toBe(true);
  });

  it('allows the media types the studio actually sends', () => {
    for (const type of ['image/png', 'image/jpeg', 'video/mp4', 'audio/mpeg']) {
      expect(ALLOWED_UPLOAD_TYPES.has(type)).toBe(true);
    }
    // Anything that could be executed or served as a page stays out.
    for (const type of ['text/html', 'application/x-msdownload', 'image/svg+xml']) {
      expect(ALLOWED_UPLOAD_TYPES.has(type)).toBe(false);
    }
  });
});

describe('archiving a finished generation', () => {
  it('copies the vendor output into our own storage', async () => {
    const payload = Buffer.from('fake mp4 bytes');
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(payload, { status: 200, headers: { 'content-type': 'video/mp4' } })) as typeof fetch;

    try {
      const archived = await service.archiveFromUrl('gen-1', 'https://vendor.example/expiring.mp4');
      expect(archived?.key.startsWith('generations/')).toBe(true);

      const stored = await service.read(archived!.key);
      expect(stored?.body.toString()).toBe('fake mp4 bytes');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('never loses the generation when archiving fails', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => { throw new Error('network down'); }) as typeof fetch;

    try {
      // Returning null tells the caller to keep the vendor URL and carry on.
      expect(await service.archiveFromUrl('gen-2', 'https://vendor.example/x.mp4')).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('backend selection', () => {
  it('uses R2 only when every credential is present', () => {
    const partial = new TestConfig();
    partial.values.R2_ACCOUNT_ID = 'acct';
    expect(R2Storage.isConfigured(partial)).toBe(false);

    partial.values.R2_ACCESS_KEY_ID = 'key';
    partial.values.R2_SECRET_ACCESS_KEY = 'secret';
    expect(R2Storage.isConfigured(partial)).toBe(true);
  });
});
