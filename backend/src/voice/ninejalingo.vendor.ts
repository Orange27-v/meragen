import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  VoiceVendor, SpeakParams, SpokenAudio, CloneParams, ClonedVoice, voiceErrorFrom,
} from './voice.types';
import { VendorError, FailureKind } from '../vendors/vendor.types';

/**
 * 9jaLingo — Nigerian-language speech and voice cloning.
 *
 * Verified against the live API on 2026-08-27:
 *   POST /v1/audio/speech   synchronous, returns audio bytes
 *   auth                    x-api-key (Bearer returns "Missing API Key")
 *   model                   9jalingo-tts-1
 *   languages               ha · ig · yo · pcm
 *
 * Prices in Naira, per 1,000 characters — ₦50 standard, ₦51 for a cloned
 * voice. Both facts matter: Naira billing keeps MyVoice out of the FX exposure
 * the rest of the pricing engine defends against, and per-character billing
 * means the price is knowable from the text *before* credits are taken, which
 * is how every charge in this system works.
 */
const KOBO_PER_1000_CHARS_STANDARD = 50_00;
const KOBO_PER_1000_CHARS_CLONED = 51_00;

/** Their model sleeps when idle; waking it has been seen to take minutes. */
const SPEAK_TIMEOUT_MS = 120_000;
const CLONE_TIMEOUT_MS = 180_000;

@Injectable()
export class NineJaLingoVendor implements VoiceVendor {
  readonly name = 'ninejalingo';
  private readonly logger = new Logger(NineJaLingoVendor.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(config: ConfigService) {
    this.baseUrl = config.get<string>('NINEJALINGO_BASE_URL', 'https://api.9jalingo.org');
    this.apiKey = config.get<string>('NINEJALINGO_KEY', '');
    if (!this.apiKey) this.logger.log('NINEJALINGO_KEY not set — MyVoice is off');
  }

  get available(): boolean {
    return Boolean(this.apiKey);
  }

  costKobo(characters: number, cloned: boolean): number {
    const rate = cloned ? KOBO_PER_1000_CHARS_CLONED : KOBO_PER_1000_CHARS_STANDARD;
    // Round up: a vendor charging per 1,000 characters will not bill a fraction
    // in our favour, and guessing low costs us on every call.
    return Math.ceil((characters / 1000) * rate);
  }

  private async request(path: string, init: RequestInit, timeoutMs: number): Promise<Response> {
    const abort = AbortSignal.timeout(timeoutMs);
    try {
      return await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: { 'x-api-key': this.apiKey, ...(init.headers ?? {}) },
        signal: abort,
      });
    } catch (error) {
      // A timeout against a sleeping model is worth retrying, not refunding.
      throw new VendorError(
        FailureKind.TRANSIENT,
        'Voice service did not respond',
        (error as Error).message,
      );
    }
  }

  async speak(params: SpeakParams): Promise<SpokenAudio> {
    if (!this.available) {
      throw new VendorError(FailureKind.VENDOR_INSUFFICIENT_FUNDS, 'MyVoice is not configured');
    }

    const format = params.format ?? 'mp3';
    const response = await this.request(
      '/v1/audio/speech',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: '9jalingo-tts-1',
          input: params.text,
          lang: params.language,
          ...(params.voiceId ? { voice: params.voiceId } : {}),
          response_format: format,
        }),
      },
      SPEAK_TIMEOUT_MS,
    );

    if (!response.ok) throw voiceErrorFrom(response.status, await response.text());

    const audio = Buffer.from(await response.arrayBuffer());
    // A JSON body with an audio content-type asked for means something went
    // wrong that the status code did not admit to.
    if (audio.subarray(0, 1).toString() === '{') {
      throw voiceErrorFrom(502, audio.toString('utf8').slice(0, 300));
    }

    return { audio, contentType: format === 'wav' ? 'audio/wav' : 'audio/mpeg' };
  }

  /**
   * Registers a customer's voice.
   *
   * `POST /v1/audio/clone` exists — it answers `allow: POST` and rejects an
   * unauthenticated call — but its body is undocumented, and 9jaLingo checks
   * the API key before validating fields, so the exact field names could not be
   * discovered without spending a real request against a live key.
   *
   * This sends multipart with the names every comparable API uses (Spitch's
   * documented clone endpoint takes exactly `audio`, `name`, `language`,
   * `transcript`). If those are wrong, the vendor's own message is surfaced
   * verbatim rather than swallowed, so the first real attempt tells us the
   * truth instead of failing silently.
   */
  async clone(params: CloneParams): Promise<ClonedVoice> {
    if (!this.available) {
      throw new VendorError(FailureKind.VENDOR_INSUFFICIENT_FUNDS, 'MyVoice is not configured');
    }

    const form = new FormData();
    form.append('audio', new Blob([new Uint8Array(params.sample)], { type: params.sampleContentType }), 'sample.wav');
    form.append('name', params.name);
    form.append('language', params.language);
    if (params.transcript) form.append('transcript', params.transcript);

    const response = await this.request('/v1/audio/clone', { method: 'POST', body: form }, CLONE_TIMEOUT_MS);
    const body = await response.text();

    if (!response.ok) {
      this.logger.warn(`Clone rejected (${response.status}): ${body.slice(0, 400)}`);
      throw voiceErrorFrom(response.status, body);
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(body) as Record<string, unknown>;
    } catch {
      throw new VendorError(FailureKind.UNKNOWN, 'Voice service returned an unreadable response', body.slice(0, 300));
    }

    // Accept whichever id field they use rather than guessing one.
    const voiceId =
      (parsed.voice_id ?? parsed.voiceId ?? parsed.id ?? parsed.speaker ?? parsed.speaker_id) as string | undefined;
    if (!voiceId) {
      throw new VendorError(
        FailureKind.UNKNOWN,
        'Voice service accepted the sample but returned no voice id',
        body.slice(0, 300),
      );
    }

    const status = String(parsed.status ?? 'ready').toLowerCase();
    return { voiceId, ready: status === 'ready' || status === 'completed' || status === 'succeeded' };
  }
}
