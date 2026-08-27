import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient, BrandAssetType, GenerationStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/common/prisma.service';
import { CreditsService } from '../src/credits/credits.service';
import { StorageService } from '../src/storage/storage.service';
import { BrandService } from '../src/brand/brand.service';
import { VoiceService } from '../src/voice/voice.service';
import { VoicePricing } from '../src/voice/voice.pricing';
import { NineJaLingoVendor } from '../src/voice/ninejalingo.vendor';
import { VoiceLanguage, isColdStart, voiceErrorFrom, SpokenAudio, ClonedVoice } from '../src/voice/voice.types';
import { FailureKind, VendorError } from '../src/vendors/vendor.types';
import { InsufficientCreditsError } from '../src/credits/credits.errors';

const prisma = new PrismaClient() as PrismaService;
const credits = new CreditsService(prisma);

class TestConfig extends ConfigService {
  values: Record<string, string> = { MIN_GROSS_MARGIN: '0.20', NINEJALINGO_KEY: 'test-key' };
  override get<T>(k: string, fallback?: T): T { return (this.values[k] ?? fallback) as T; }
}

class FakeStorage {
  async putUpload(userId: string, body: Buffer, contentType: string) {
    return { key: `uploads/${userId}/${crypto.randomUUID()}`, url: 'https://files.test/audio.mp3' };
  }
  async freshUrl(k: string) { return `https://files.test/${k}`; }
}

class FakeVendor extends NineJaLingoVendor {
  speakError: Error | null = null;
  cloneError: Error | null = null;
  cloneResult: ClonedVoice = { voiceId: 'vnd-voice-1', ready: true };
  spoke = 0;
  constructor() { super(new TestConfig()); }
  override get available() { return true; }
  override async speak(): Promise<SpokenAudio> {
    this.spoke++;
    if (this.speakError) throw this.speakError;
    return { audio: Buffer.from('fake mp3'), contentType: 'audio/mpeg' };
  }
  override async clone(): Promise<ClonedVoice> {
    if (this.cloneError) throw this.cloneError;
    return this.cloneResult;
  }
}

const config = new TestConfig();
const storage = new FakeStorage() as unknown as StorageService;
const brand = new BrandService(prisma, storage);
const vendor = new FakeVendor();
const voice = new VoiceService(prisma, credits, storage, brand, new VoicePricing(config), vendor);

let userId: string;
const sample = () => Buffer.alloc(64 * 1024, 1);

async function fund(amount: number): Promise<string> {
  const user = await prisma.user.create({ data: { email: `v-${crypto.randomUUID()}@meerahstudio.com` } });
  if (amount > 0) {
    await credits.topup({ userId: user.id, credits: amount, paystackRef: `seed-${crypto.randomUUID()}` });
  }
  return user.id;
}

beforeAll(async () => { await prisma.$connect(); });
afterAll(async () => { await prisma.$disconnect(); });
beforeEach(async () => {
  vendor.speakError = null;
  vendor.cloneError = null;
  vendor.spoke = 0;
  config.values.MIN_GROSS_MARGIN = '0.20';
  userId = await fund(100);
});

describe('pricing speech', () => {
  it('prices from the character count, exactly', () => {
    // ₦51 per 1,000 characters for a cloned voice, 60% target margin,
    // rounded up to a whole credit.
    const quote = voice.quote('a'.repeat(1000), true);

    expect(quote.characters).toBe(1000);
    expect(quote.breakdown.vendorCostNaira).toBe(51);
    expect(quote.credits).toBe(3);
    expect(quote.naira).toBe(150);
    expect(quote.breakdown.realisedMargin).toBeGreaterThanOrEqual(0.6);
  });

  it('never charges less than one credit', () => {
    expect(voice.quote('Bawo ni.', false).credits).toBe(1);
  });

  it('is denominated in Naira, so FX cannot erode it', () => {
    // The rest of the pricing engine defends a USD cost base against naira
    // depreciation. This vendor bills in ₦, so that problem does not apply.
    expect(voice.quote('a'.repeat(500), true).breakdown.nairaDenominated).toBe(true);
  });

  it('refuses empty and over-long text', () => {
    expect(() => voice.quote('   ', false)).toThrow(/Type something/);
    expect(() => voice.quote('a'.repeat(5001), false)).toThrow(/too long/);
  });

  it('charges slightly more for a cloned voice, as the vendor does', () => {
    const plain = voice.quote('a'.repeat(4000), false);
    const cloned = voice.quote('a'.repeat(4000), true);

    expect(cloned.breakdown.vendorCostNaira).toBeGreaterThan(plain.breakdown.vendorCostNaira);
  });
});

describe('cloning a voice', () => {
  it('saves it as a voice profile with the vendor handle', async () => {
    const result = await voice.cloneVoice({
      userId, sample: sample(), contentType: 'audio/wav',
      name: 'My voice', language: VoiceLanguage.pidgin, consent: true,
    });

    const asset = await prisma.brandAsset.findUniqueOrThrow({ where: { id: result.id } });
    expect(asset.type).toBe(BrandAssetType.voice_profile);
    expect(asset.vendorReference).toBe('vnd-voice-1');
    // Consent is recorded against the asset, not just passed to the vendor.
    expect((asset.metadata as Record<string, unknown>).consentGivenAt).toBeTruthy();
  });

  it('refuses without consent', async () => {
    // Cloning someone else's voice is the obvious abuse of this feature, and in
    // this market a cloned voice is a fraud tool.
    await expect(voice.cloneVoice({
      userId, sample: sample(), contentType: 'audio/wav',
      name: 'Not mine', language: VoiceLanguage.yoruba, consent: false,
    })).rejects.toThrow(/permission/);
  });

  it('refuses a recording that is too short, or the wrong kind of file', async () => {
    await expect(voice.cloneVoice({
      userId, sample: Buffer.alloc(100), contentType: 'audio/wav',
      name: 'Too short', language: VoiceLanguage.igbo, consent: true,
    })).rejects.toThrow(/at least five seconds/);

    await expect(voice.cloneVoice({
      userId, sample: sample(), contentType: 'video/mp4',
      name: 'Wrong type', language: VoiceLanguage.igbo, consent: true,
    })).rejects.toThrow(/WAV, MP3 or M4A/);
  });

  it('costs nothing — registration is free, speech is what is charged', async () => {
    const before = await credits.getBalance(userId);
    await voice.cloneVoice({
      userId, sample: sample(), contentType: 'audio/wav',
      name: 'Free to try', language: VoiceLanguage.hausa, consent: true,
    });
    expect(await credits.getBalance(userId)).toBe(before);
  });
});

describe('speaking', () => {
  it('charges, stores the audio, and reports the new balance', async () => {
    const result = await voice.speak({ userId, text: 'Bawo ni, welcome to Meerah.', language: VoiceLanguage.pidgin });

    expect(result.url).toContain('files.test');
    expect(result.credits).toBe(1);
    expect(result.balanceAfter).toBe(99);
    expect(result.cloned).toBe(false);
  });

  it('uses a saved voice and counts the use', async () => {
    const cloned = await voice.cloneVoice({
      userId, sample: sample(), contentType: 'audio/wav',
      name: 'Mine', language: VoiceLanguage.yoruba, consent: true,
    });

    const result = await voice.speak({
      userId, text: 'Ẹ kú àárọ̀.', language: VoiceLanguage.yoruba, voiceAssetId: cloned.id,
    });

    expect(result.cloned).toBe(true);
    expect((await brand.get(userId, cloned.id)).usedCount).toBe(1);
  });

  it("refuses another account's saved voice, without confirming it exists", async () => {
    const mine = await voice.cloneVoice({
      userId, sample: sample(), contentType: 'audio/wav',
      name: 'Private', language: VoiceLanguage.igbo, consent: true,
    });
    const stranger = await fund(50);

    await expect(voice.speak({
      userId: stranger, text: 'hello', language: VoiceLanguage.igbo, voiceAssetId: mine.id,
    })).rejects.toThrow(/No such saved voice/);
  });

  it('refunds when the vendor fails, and never leaves credits missing', async () => {
    vendor.speakError = new VendorError(FailureKind.TRANSIENT, 'cold', 'idle period');
    const before = await credits.getBalance(userId);

    await expect(voice.speak({ userId, text: 'hello there', language: VoiceLanguage.pidgin }))
      .rejects.toBeInstanceOf(VendorError);

    expect(await credits.getBalance(userId)).toBe(before);
    expect((await credits.audit(userId)).consistent).toBe(true);

    const generation = await prisma.generation.findFirst({
      where: { userId, feature: 'MyVoice' }, orderBy: { createdAt: 'desc' },
    });
    expect(generation?.status).toBe(GenerationStatus.failed);
    expect(generation?.refundedAt).not.toBeNull();
  });

  it('does not call the vendor when the customer cannot pay', async () => {
    userId = await fund(0);

    await expect(voice.speak({ userId, text: 'a'.repeat(2000), language: VoiceLanguage.hausa }))
      .rejects.toBeInstanceOf(InsufficientCreditsError);

    expect(vendor.spoke).toBe(0);
  });
});

describe('a sleeping vendor is not a failed job', () => {
  it('recognises 9jaLingo’s cold start and marks it retryable', () => {
    const body = '{"detail":"Inference capacity is starting after an idle period. Please retry shortly in about 5 minutes."}';

    expect(isColdStart(503, body)).toBe(true);

    const error = voiceErrorFrom(503, body);
    expect(error.kind).toBe(FailureKind.TRANSIENT);
    // Retryable, so a worker waits it out instead of burning the customer's credits.
    expect(error.retryable).toBe(true);
  });

  it('treats the starter rate limit as retryable too', () => {
    const error = voiceErrorFrom(429, '{"detail":"STARTER_RATE_LIMIT_EXCEEDED"}');
    expect(error.kind).toBe(FailureKind.RATE_LIMITED);
    expect(error.retryable).toBe(true);
  });

  it('treats a rejected key as ours to fix, not the customer’s', () => {
    const error = voiceErrorFrom(401, '{"detail":"Invalid API Key"}');
    expect(error.kind).toBe(FailureKind.VENDOR_INSUFFICIENT_FUNDS);
    expect(error.userMessage).not.toContain('key');
  });
});

describe('the real vendor’s own arithmetic', () => {
  it('bills per 1,000 characters, rounding up', () => {
    const real = new NineJaLingoVendor(new TestConfig());

    expect(real.costKobo(1000, false)).toBe(50_00);
    expect(real.costKobo(1000, true)).toBe(51_00);
    // Half the text, half the cost.
    expect(real.costKobo(500, true)).toBe(2550);
    // Never rounds down in the vendor's favour.
    expect(real.costKobo(1, false)).toBe(5);
  });
});
