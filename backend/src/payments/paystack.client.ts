import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface InitializeResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

export interface VerifiedTransaction {
  reference: string;
  status: string;
  amountKobo: number;
  currency: string;
  paidAt: string | null;
  customerEmail: string | null;
  metadata: Record<string, unknown>;
}

/**
 * Thin wrapper over the Paystack REST API.
 *
 * The secret key never leaves this process — the browser only ever sees the
 * checkout URL Paystack hands back.
 */
@Injectable()
export class PaystackClient {
  private readonly logger = new Logger(PaystackClient.name);
  private readonly secretKey: string;
  private readonly baseUrl = 'https://api.paystack.co';

  constructor(config: ConfigService) {
    this.secretKey = config.get<string>('PAYSTACK_SECRET_KEY', '');
    if (!this.secretKey) {
      this.logger.warn('PAYSTACK_SECRET_KEY is not set — payments will fail');
    }
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });

    const body = (await response.json()) as { status: boolean; message: string; data: T };
    if (!response.ok || !body.status) {
      throw new Error(`Paystack ${path} failed: ${response.status} ${body?.message ?? 'unknown error'}`);
    }
    return body.data;
  }

  /**
   * Opens a checkout session. We pass our own `reference` so the webhook that
   * comes back later can be tied to the exact user and pack without trusting
   * anything the browser says.
   */
  async initializeTransaction(params: {
    email: string;
    amountKobo: number;
    reference: string;
    metadata: Record<string, unknown>;
    callbackUrl?: string;
  }): Promise<InitializeResult> {
    const data = await this.request<{
      authorization_url: string;
      access_code: string;
      reference: string;
    }>('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email: params.email,
        amount: params.amountKobo,
        reference: params.reference,
        currency: 'NGN',
        metadata: params.metadata,
        ...(params.callbackUrl ? { callback_url: params.callbackUrl } : {}),
      }),
    });

    return {
      authorizationUrl: data.authorization_url,
      accessCode: data.access_code,
      reference: data.reference,
    };
  }

  /**
   * Asks Paystack directly what happened to a transaction.
   *
   * We call this even after a valid webhook. A signature proves the message came
   * from Paystack, not that its contents match their records — verifying closes
   * the gap for the price of one HTTP call.
   */
  async verifyTransaction(reference: string): Promise<VerifiedTransaction> {
    const data = await this.request<{
      reference: string;
      status: string;
      amount: number;
      currency: string;
      paid_at: string | null;
      customer?: { email?: string };
      metadata?: Record<string, unknown>;
    }>(`/transaction/verify/${encodeURIComponent(reference)}`);

    return {
      reference: data.reference,
      status: data.status,
      amountKobo: data.amount,
      currency: data.currency,
      paidAt: data.paid_at,
      customerEmail: data.customer?.email ?? null,
      metadata: data.metadata ?? {},
    };
  }

  /**
   * Successful transactions since a given time.
   *
   * Used by reconciliation to find payments that were never credited — the ones
   * where the webhook never arrived and the customer closed the tab.
   */
  async listSuccessfulTransactions(fromIso: string): Promise<Array<{ reference: string; amountKobo: number }>> {
    const params = new URLSearchParams({ status: 'success', from: fromIso, perPage: '100' });
    const data = await this.request<Array<{ reference: string; amount: number }>>(
      `/transaction?${params.toString()}`,
    );
    return data.map((row) => ({ reference: row.reference, amountKobo: row.amount }));
  }

  /**
   * Confirms a webhook really came from Paystack.
   *
   * Paystack signs the raw request body with HMAC-SHA512 using the secret key.
   * Compared in constant time so an attacker cannot narrow the signature down by
   * measuring how long the comparison takes.
   */
  verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean {
    if (!signature || !this.secretKey) return false;

    const expected = createHmac('sha512', this.secretKey).update(rawBody).digest('hex');
    const received = Buffer.from(signature, 'utf8');
    const computed = Buffer.from(expected, 'utf8');

    if (received.length !== computed.length) return false;
    return timingSafeEqual(received, computed);
  }
}
