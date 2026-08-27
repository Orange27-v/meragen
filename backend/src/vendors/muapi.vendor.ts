import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GenerationVendor, GenerationParams, VendorJobHandle, JobStatus, CostEstimate,
  VendorError, FailureKind,
} from './vendor.types';
import { usdToMicros } from '../pricing/money';

const SUCCESS = new Set(['completed', 'succeeded', 'success']);
const FAILURE = new Set(['failed', 'error', 'cancelled', 'canceled']);

/**
 * MuAPI — our primary aggregator. Submit, then poll.
 *
 * Our API key lives here and nowhere else; it is never sent to a browser.
 */
@Injectable()
export class MuApiVendor implements GenerationVendor {
  readonly name = 'muapi';
  private readonly logger = new Logger(MuApiVendor.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(config: ConfigService) {
    this.baseUrl = config.get<string>('MUAPI_BASE_URL', 'https://api.muapi.ai');
    this.apiKey = config.get<string>('MUAPI_KEY', '');
    if (!this.apiKey) this.logger.warn('MUAPI_KEY is not set — generation will fail');
  }

  private headers(): Record<string, string> {
    return { 'Content-Type': 'application/json', 'x-api-key': this.apiKey };
  }

  /**
   * Turns whatever a vendor did into one of our failure kinds.
   *
   * This is the load-bearing part of the abstraction: refund logic reads only
   * our taxonomy, so it behaves identically no matter which vendor broke or how
   * creatively it phrased the breakage.
   */
  private classify(status: number, body: string): VendorError {
    const text = body.toLowerCase();

    if (status === 429) {
      return new VendorError(FailureKind.RATE_LIMITED, 'Vendor rate limit', body);
    }
    if (status === 401 || status === 403) {
      // Our key, our problem — not the customer's.
      return new VendorError(FailureKind.VENDOR_INSUFFICIENT_FUNDS, 'Vendor auth rejected', body);
    }
    if (status >= 500) {
      return new VendorError(FailureKind.TRANSIENT, `Vendor ${status}`, body);
    }
    if (
      text.includes('content policy') || text.includes('nsfw') ||
      text.includes('safety') || text.includes('moderation') || text.includes('prohibited')
    ) {
      return new VendorError(FailureKind.POLICY_REJECTED, 'Content rejected by vendor', body);
    }
    if (
      text.includes('insufficient') || text.includes('balance') ||
      text.includes('quota') || text.includes('credit')
    ) {
      return new VendorError(FailureKind.VENDOR_INSUFFICIENT_FUNDS, 'Vendor account out of funds', body);
    }
    if (status === 400 || status === 422) {
      return new VendorError(FailureKind.INVALID_INPUT, 'Vendor rejected the request', body);
    }
    return new VendorError(FailureKind.UNKNOWN, `Vendor error ${status}`, body);
  }

  async estimateCost(params: GenerationParams): Promise<CostEstimate> {
    const response = await fetch(
      `${this.baseUrl}/api/v1/models/${encodeURIComponent(params.modelId)}/estimate-cost`,
      { method: 'POST', headers: this.headers(), body: JSON.stringify(params.options ?? {}) },
    );

    if (!response.ok) throw this.classify(response.status, await response.text());

    const body = (await response.json()) as { cost?: number };
    if (typeof body.cost !== 'number') {
      throw new VendorError(FailureKind.UNKNOWN, 'Vendor returned no cost');
    }
    return { costUsdMicros: usdToMicros(body.cost) };
  }

  async submitJob(params: GenerationParams): Promise<VendorJobHandle> {
    const payload: Record<string, unknown> = { ...(params.options ?? {}) };
    if (params.prompt) payload.prompt = params.prompt;

    const response = await fetch(`${this.baseUrl}/api/v1/${encodeURIComponent(params.modelId)}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw this.classify(response.status, await response.text());

    const body = (await response.json()) as { request_id?: string; id?: string };
    const vendorJobId = body.request_id ?? body.id;
    if (!vendorJobId) {
      throw new VendorError(FailureKind.UNKNOWN, 'Vendor accepted the job but returned no id');
    }
    return { vendorJobId };
  }

  async checkStatus(handle: VendorJobHandle): Promise<JobStatus> {
    const response = await fetch(
      `${this.baseUrl}/api/v1/predictions/${encodeURIComponent(handle.vendorJobId)}/result`,
      { headers: this.headers() },
    );

    if (!response.ok) throw this.classify(response.status, await response.text());

    const body = (await response.json()) as {
      status?: string;
      outputs?: string[];
      url?: string;
      output?: { url?: string };
      error?: string | { message?: string };
    };

    const state = (body.status ?? '').toLowerCase();

    if (SUCCESS.has(state)) {
      const outputUrl = body.outputs?.[0] ?? body.url ?? body.output?.url;
      if (!outputUrl) {
        return {
          state: 'failed',
          error: new VendorError(FailureKind.UNKNOWN, 'Vendor reported success but returned no output'),
        };
      }
      return { state: 'completed', outputUrl };
    }

    if (FAILURE.has(state)) {
      const detail =
        typeof body.error === 'string' ? body.error : body.error?.message ?? 'Vendor job failed';
      // A job that failed *after* being accepted is classified from its message.
      return { state: 'failed', error: this.classify(400, detail) };
    }

    return { state: 'processing' };
  }
}
