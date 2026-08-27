import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { BrandAssetType, GenerationStatus, Vendor } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { CreditsService } from '../credits/credits.service';
import { AlreadyRefundedError } from '../credits/credits.errors';
import { StorageService } from '../storage/storage.service';
import { BrandService } from '../brand/brand.service';
import { NineJaLingoVendor } from './ninejalingo.vendor';
import { VoicePricing, MAX_CHARACTERS, VoiceQuote } from './voice.pricing';
import { VoiceLanguage, VOICE_LANGUAGE_NAMES, VoiceVendor } from './voice.types';
import { VendorError } from '../vendors/vendor.types';

/** A clone needs enough speech to work from, and not a whole podcast. */
const MIN_SAMPLE_BYTES = 8 * 1024;
const MAX_SAMPLE_BYTES = 10 * 1024 * 1024;
const ALLOWED_SAMPLE_TYPES = new Set(['audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/webm', 'audio/ogg']);

export interface SpeechResult {
  generationId: string;
  url: string;
  credits: number;
  balanceAfter: number;
  language: string;
  cloned: boolean;
}

/**
 * MyVoice — the differentiator.
 *
 * Two things: register a customer's own voice from a short recording, and speak
 * any text in Pidgin, Yorùbá, Igbo or Hausa. The cloned voice is stored as a
 * brand asset, so it sits alongside their saved characters and templates and
 * makes leaving expensive (planning.md §1).
 *
 * Charging follows the same rule as everything else — quote, charge, do the
 * work, refund on failure — with one difference: speech is priced per character,
 * so the quote is exact rather than estimated.
 */
@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly credits: CreditsService,
    private readonly storage: StorageService,
    private readonly brand: BrandService,
    private readonly pricing: VoicePricing,
    private readonly vendor: NineJaLingoVendor,
  ) {}

  get provider(): VoiceVendor {
    return this.vendor;
  }

  get available(): boolean {
    return this.vendor.available;
  }

  languages(): Array<{ code: string; name: string }> {
    return Object.values(VoiceLanguage).map((code) => ({ code, name: VOICE_LANGUAGE_NAMES[code] }));
  }

  /** What this text will cost, before anything is charged. */
  quote(text: string, cloned: boolean): VoiceQuote {
    const characters = text.trim().length;
    if (characters === 0) throw new BadRequestException('Type something for the voice to say.');
    if (characters > MAX_CHARACTERS) {
      throw new BadRequestException(`That is too long. Keep it under ${MAX_CHARACTERS.toLocaleString()} characters.`);
    }
    return this.pricing.quote(this.vendor, characters, cloned);
  }

  /**
   * Registers a customer's voice from a recording.
   *
   * Free: cloning costs us nothing per se — the vendor charges for speech, not
   * for registration — and charging for it would stop people trying the one
   * feature that makes them stay.
   */
  async cloneVoice(params: {
    userId: string;
    sample: Buffer;
    contentType: string;
    name: string;
    language: VoiceLanguage;
    transcript?: string;
    consent: boolean;
  }): Promise<{ id: string; name: string; language: string }> {
    // Cloning a voice that is not yours is the obvious abuse of this feature,
    // and in this market a cloned voice is a fraud tool. Consent is recorded
    // against the asset, not merely passed to the vendor.
    if (!params.consent) {
      throw new BadRequestException('Confirm this is your own voice, or that you have the speaker’s permission.');
    }
    if (!params.name?.trim()) throw new BadRequestException('Give the voice a name.');

    const type = params.contentType?.split(';')[0] ?? '';
    if (!ALLOWED_SAMPLE_TYPES.has(type)) {
      throw new BadRequestException('Record or upload a WAV, MP3 or M4A file.');
    }
    if (params.sample.length < MIN_SAMPLE_BYTES) {
      throw new BadRequestException('That recording is too short. Speak for at least five seconds.');
    }
    if (params.sample.length > MAX_SAMPLE_BYTES) {
      throw new BadRequestException('That recording is too large. Keep it under 10MB.');
    }

    const cloned = await this.vendor.clone({
      sample: params.sample,
      sampleContentType: type,
      name: params.name.trim(),
      language: params.language,
      transcript: params.transcript,
    });

    // Keep the sample: the vendor may need re-registering, and a customer who
    // switches provider should not have to record again.
    const stored = await this.storage.putUpload(params.userId, params.sample, type);

    const asset = await this.brand.create({
      userId: params.userId,
      type: BrandAssetType.voice_profile,
      name: params.name.trim(),
      vendorReference: cloned.voiceId,
      storageKey: stored.key,
      metadata: {
        provider: this.vendor.name,
        language: params.language,
        ready: cloned.ready,
        consentGivenAt: new Date().toISOString(),
        transcript: params.transcript ?? null,
      },
    });

    this.logger.log(`Cloned voice "${params.name}" (${params.language}) for ${params.userId}`);
    return { id: asset.id, name: asset.name, language: params.language };
  }

  /**
   * Speaks text, charging for it.
   *
   * Synchronous rather than queued: speech comes back in seconds, and a
   * customer waiting on a page is better served by an answer than a job id.
   * The cold-start case is classified as retryable, so a sleeping vendor
   * refunds and asks them to try again rather than silently eating credits.
   */
  async speak(params: {
    userId: string;
    text: string;
    language: VoiceLanguage;
    /** A saved voice_profile asset. Omit to use a preset vendor voice. */
    voiceAssetId?: string;
  }): Promise<SpeechResult> {
    let vendorVoiceId: string | undefined;

    if (params.voiceAssetId) {
      const asset = await this.prisma.brandAsset.findFirst({
        where: { id: params.voiceAssetId, userId: params.userId, type: BrandAssetType.voice_profile },
        select: { id: true, vendorReference: true },
      });
      // Same answer as missing, so an id cannot be used to probe another
      // account's saved voices.
      if (!asset?.vendorReference) throw new NotFoundException('No such saved voice');
      vendorVoiceId = asset.vendorReference;
    }

    const quote = this.quote(params.text, Boolean(vendorVoiceId));

    const generation = await this.prisma.generation.create({
      data: {
        userId: params.userId,
        feature: 'MyVoice',
        vendor: Vendor.ninejalingo,
        modelId: '9jalingo-tts-1',
        status: GenerationStatus.processing,
        inputParams: {
          text: params.text,
          language: params.language,
          characters: quote.characters,
          cloned: quote.cloned,
        },
        costCredits: quote.credits,
      },
    });

    await this.credits.charge({
      userId: params.userId,
      credits: quote.credits,
      generationId: generation.id,
      idempotencyKey: `voice:${generation.id}`,
    });

    try {
      const spoken = await this.vendor.speak({
        text: params.text,
        language: params.language,
        voiceId: vendorVoiceId,
        format: 'mp3',
      });

      const stored = await this.storage.putUpload(params.userId, spoken.audio, spoken.contentType);

      await this.prisma.generation.update({
        where: { id: generation.id },
        data: {
          status: GenerationStatus.completed,
          outputUrl: stored.url,
          storageKey: stored.key,
          completedAt: new Date(),
        },
      });

      if (params.voiceAssetId) await this.brand.markUsed(params.userId, params.voiceAssetId);

      return {
        generationId: generation.id,
        url: stored.url,
        credits: quote.credits,
        balanceAfter: await this.credits.getBalance(params.userId),
        language: params.language,
        cloned: quote.cloned,
      };
    } catch (error) {
      await this.refund(generation.id, error as Error);
      throw error;
    }
  }

  private async refund(generationId: string, error: Error): Promise<void> {
    try {
      await this.credits.refundGeneration(generationId);
    } catch (refundError) {
      if (!(refundError instanceof AlreadyRefundedError)) throw refundError;
    }

    const message = error instanceof VendorError
      ? error.userMessage
      : 'That voiceover could not be made and your credits have been returned.';

    await this.prisma.generation.update({
      where: { id: generationId },
      data: { status: GenerationStatus.failed, errorMessage: message, completedAt: new Date() },
    });

    this.logger.warn(`MyVoice ${generationId} failed and was refunded: ${error.message}`);
  }
}
