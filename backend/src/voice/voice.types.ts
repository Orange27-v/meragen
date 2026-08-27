import { VendorError, FailureKind } from '../vendors/vendor.types';

/**
 * The four languages MyVoice exists for.
 *
 * Codes match 9jaLingo's and Spitch's — both use ISO 639 with `pcm` for
 * Nigerian Pidgin, so a vendor swap needs no translation layer.
 */
export enum VoiceLanguage {
  pidgin = 'pcm',
  yoruba = 'yo',
  igbo = 'ig',
  hausa = 'ha',
}

export const VOICE_LANGUAGE_NAMES: Record<VoiceLanguage, string> = {
  [VoiceLanguage.pidgin]: 'Nigerian Pidgin',
  [VoiceLanguage.yoruba]: 'Yorùbá',
  [VoiceLanguage.igbo]: 'Igbo',
  [VoiceLanguage.hausa]: 'Hausa',
};

export function isVoiceLanguage(value: string): value is VoiceLanguage {
  return Object.values(VoiceLanguage).includes(value as VoiceLanguage);
}

export interface SpeakParams {
  text: string;
  language: VoiceLanguage;
  /** A preset voice id, or the id of a voice this customer cloned. */
  voiceId?: string;
  format?: 'mp3' | 'wav';
}

export interface SpokenAudio {
  audio: Buffer;
  contentType: string;
}

export interface CloneParams {
  /** The customer's recording. A few seconds of clear speech. */
  sample: Buffer;
  sampleContentType: string;
  name: string;
  language: VoiceLanguage;
  /** Exact words spoken in the sample, where the vendor asks for it. */
  transcript?: string;
}

export interface ClonedVoice {
  /** The vendor's handle for this voice, stored on the brand asset. */
  voiceId: string;
  ready: boolean;
}

/**
 * One interface, two vendors.
 *
 * 9jaLingo is 3.3x cheaper and bills in Naira — which takes MyVoice out of the
 * FX exposure that the rest of the pricing engine has to defend against — and
 * charges per character, so a price can be quoted exactly before credits are
 * taken. Spitch is the fallback: its cloning contract is fully documented, it
 * has no observed cold start, and it adds Yorùbá tone marking.
 *
 * The seam matters more here than anywhere else in the system: this is the
 * feature the moat depends on, and it currently rests on one small vendor.
 */
export interface VoiceVendor {
  readonly name: string;
  readonly available: boolean;

  /** What the vendor charges, in kobo, for a given amount of text. */
  costKobo(characters: number, cloned: boolean): number;

  speak(params: SpeakParams): Promise<SpokenAudio>;
  clone(params: CloneParams): Promise<ClonedVoice>;
}

/**
 * A cold vendor is not a failed generation.
 *
 * 9jaLingo shuts its model down when idle and takes minutes to wake. Treating
 * that as a failure would charge and refund a customer for nothing; treating it
 * as retryable lets the worker wait it out.
 */
export function isColdStart(status: number, body: string): boolean {
  return status === 503 && /capacity is starting|idle period/i.test(body);
}

export function voiceErrorFrom(status: number, body: string): VendorError {
  if (isColdStart(status, body)) {
    return new VendorError(
      FailureKind.TRANSIENT,
      'Voice service is warming up',
      body,
    );
  }
  if (status === 429) {
    return new VendorError(FailureKind.RATE_LIMITED, 'Voice service rate limit', body);
  }
  if (status === 401 || status === 403) {
    return new VendorError(FailureKind.VENDOR_INSUFFICIENT_FUNDS, 'Voice vendor rejected our key', body);
  }
  if (status >= 500) {
    return new VendorError(FailureKind.TRANSIENT, `Voice service ${status}`, body);
  }
  if (status === 400 || status === 422) {
    return new VendorError(FailureKind.INVALID_INPUT, 'Voice service rejected the request', body);
  }
  return new VendorError(FailureKind.UNKNOWN, `Voice service error ${status}`, body);
}
