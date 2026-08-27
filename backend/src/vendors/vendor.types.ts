/**
 * One interface every vendor implements, so feature code never branches on who
 * is doing the work (planning.md §5).
 *
 * We launch with MuAPI for everything and 9jaLingo for MyVoice. This seam is
 * what makes "go direct on a specific model later, where it wins on price or
 * quality" a config change rather than a rewrite.
 */

/** How a job ended, normalised across vendors. */
export enum FailureKind {
  /** Network blip, upstream 5xx, timeout. Worth retrying. */
  TRANSIENT = 'TRANSIENT',
  /** We are going too fast. Retry with backoff. */
  RATE_LIMITED = 'RATE_LIMITED',
  /** The vendor refused the content. Retrying changes nothing. */
  POLICY_REJECTED = 'POLICY_REJECTED',
  /** Our request was malformed. Retrying changes nothing. */
  INVALID_INPUT = 'INVALID_INPUT',
  /** Our account with the vendor is out of funds. Page someone. */
  VENDOR_INSUFFICIENT_FUNDS = 'VENDOR_INSUFFICIENT_FUNDS',
  /** Unclassified. Treated as permanent so we refund rather than loop. */
  UNKNOWN = 'UNKNOWN',
}

/** Failures worth retrying. Everything else fails fast and refunds. */
export const RETRYABLE: ReadonlySet<FailureKind> = new Set([
  FailureKind.TRANSIENT,
  FailureKind.RATE_LIMITED,
]);

export class VendorError extends Error {
  constructor(
    readonly kind: FailureKind,
    message: string,
    readonly vendorDetail?: string,
  ) {
    super(message);
    this.name = 'VendorError';
  }

  get retryable(): boolean {
    return RETRYABLE.has(this.kind);
  }

  /**
   * What the customer sees. Never leaks vendor names, model ids or stack traces
   * — a person whose advert failed needs to know what to do next, not which
   * upstream 502'd.
   */
  get userMessage(): string {
    switch (this.kind) {
      case FailureKind.POLICY_REJECTED:
        return "This prompt was rejected by the content filter. Try describing the scene differently.";
      case FailureKind.INVALID_INPUT:
        return "Something in the settings wasn't accepted. Check the prompt and any uploaded files, then try again.";
      case FailureKind.RATE_LIMITED:
      case FailureKind.TRANSIENT:
        return "The generator was busy. Your credits are safe — please try again in a moment.";
      case FailureKind.VENDOR_INSUFFICIENT_FUNDS:
        return "Generation is temporarily unavailable. Your credits have been refunded.";
      default:
        return "This generation failed and your credits have been refunded.";
    }
  }
}

export interface GenerationParams {
  modelId: string;
  prompt?: string;
  /** Everything else the model takes — resolution, duration, image urls, ... */
  options?: Record<string, unknown>;
}

export interface VendorJobHandle {
  vendorJobId: string;
}

export type JobState = 'processing' | 'completed' | 'failed';

export interface JobStatus {
  state: JobState;
  /** Present when state is 'completed'. */
  outputUrl?: string;
  /** Present when state is 'failed'. */
  error?: VendorError;
}

export interface CostEstimate {
  costUsdMicros: number;
}

export interface GenerationVendor {
  readonly name: string;
  estimateCost(params: GenerationParams): Promise<CostEstimate>;
  submitJob(params: GenerationParams): Promise<VendorJobHandle>;
  checkStatus(handle: VendorJobHandle): Promise<JobStatus>;
}
