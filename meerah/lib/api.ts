/**
 * Talks to the Meerah API.
 *
 * The session token goes out as `x-api-key` — the same header the forked studio
 * components already use, so they can be dropped in without modification.
 */

const TOKEN_KEY = 'meerah_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* private browsing — the session simply won't persist */
  }
}

export function clearToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* nothing to do */
  }
}

export class ApiError extends Error {
  constructor(readonly status: number, message: string, readonly body?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'x-api-key': token } : {}),
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message =
      (body?.message && (Array.isArray(body.message) ? body.message[0] : body.message)) ||
      'Something went wrong. Please try again.';
    throw new ApiError(response.status, message, body);
  }
  return body as T;
}

export interface User {
  id: string;
  email: string;
  creditBalance: number;
  /**
   * Whether to show the owner-only links. A display hint, not a permission:
   * the metrics route re-checks the same list server-side on every request.
   */
  isAdmin: boolean;
}
export interface AuthResult { token: string; user: User }

export interface Tier {
  tierId: string;
  label: string;
  /** What this tier produces. Filter on this, never on the wording of `spec`. */
  kind: 'video' | 'image' | 'lipsync' | 'audio' | 'upscale';
  spec: string;
  /**
   * The model this tier is pinned to. Submitting it is what earns the tier
   * price: the server prefers a pinned tier over a live quote when the two
   * agree, so the picker can name a quality and the charge stays fixed.
   * Never shown to a customer.
   */
  modelId: string;
  credits: number;
  naira: number;
  breakdown: { outputMb: number };
}

/**
 * One past generation.
 *
 * `quality` is the tier name the customer chose — "Draft", "HD". The vendor
 * model id is deliberately not part of this shape: these rows are rendered
 * straight onto the page.
 */
export interface HistoryItem {
  request_id: string;
  quality: string;
  feature: string;
  status: string;
  prompt: string;
  duration?: number;
  outputs: string[];
  cost: { amount_credits: number };
  created_at: string;
}

export interface Pack {
  id: string;
  name: string;
  naira: number;
  credits: number;
  bonusCredits: number;
  bonusPercent: number;
  paystackFee: number;
  net: number;
}

export interface PaygTerms {
  minNaira: number;
  maxNaira: number;
  creditsPerNaira: number;
}

export interface GenerationResult {
  request_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  outputs: string[];
  error?: string;
  cost: { amount_credits: number; refunded: boolean };
}

export type BrandAssetType = 'character' | 'voice_profile' | 'template';

export interface BrandAsset {
  id: string;
  type: BrandAssetType;
  name: string;
  previewUrl: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  usedCount: number;
}

export interface PlannedPost {
  id: string;
  scheduledFor: string;
  status: 'planned' | 'generating' | 'ready' | 'published' | 'failed' | 'cancelled';
  platform: string;
  tierId: string;
  prompt: string;
  caption: string | null;
  outputUrl: string | null;
  errorMessage: string | null;
}

export interface PlannerPlan {
  active: boolean;
  monthlyCredits: number;
  monthlyNaira: number;
  renewsAt: string | null;
  pausedAt: string | null;
  note: string | null;
}

export interface Metrics {
  windowDays: number;
  people: { signups: number; paying: number; conversionPercent: number; returning: number; churnedPercent: number };
  money: {
    grossNaira: number; paystackFeesNaira: number; netNaira: number; vendorCostNaira: number;
    realisedMarginPercent: number; creditsOutstanding: number; liabilityNaira: number;
  };
  work: {
    generations: number; completed: number; failed: number;
    failureRatePercent: number; refundedNaira: number; perPayingUser: number;
  };
  stickiness: { savedAssets: number; usersWithSavedAssets: number; plannerSubscribers: number };
  topModels: Array<{ modelId: string; runs: number; naira: number }>;
  daily: Array<{ date: string; signups: number; naira: number; generations: number }>;
}

export const api = {
  google: (idToken: string) =>
    request<AuthResult>('/api/v1/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    }),

  me: () => request<User>('/api/v1/auth/me'),

  pricing: () => request<{ tiers: Tier[] }>('/api/v1/pricing'),

  packs: () => request<{ packs: Pack[]; payg: PaygTerms }>('/api/v1/credit-packs'),

  /** Everything this account has made. The studios render it; nothing did before. */
  history: (limit = 50) =>
    request<{ items: HistoryItem[]; cursor: string | null }>(`/api/v1/history?limit=${limit}`),

  /** The authoritative balance, for after a charge lands. */
  balance: () => request<{ balance: number }>('/api/v1/account/balance'),

  /**
   * What a job would cost before committing to it. Only needed where cost
   * varies with the input — a fixed tier is already priced by `pricing()`.
   */
  dynamicCost: (taskName: string, payload: Record<string, unknown>) =>
    request<{ cost: number; credits: number; naira: number }>('/api/v1/app/calculate_dynamic_cost', {
      method: 'POST',
      body: JSON.stringify({ task_name: taskName, payload }),
    }),

  /**
   * Pass a packId, or an amount in Naira to pay as you go.
   *
   * `returnTo` is the path Paystack sends the browser back to. It used to be
   * hardcoded to /studio, so paying from anywhere else silently moved you.
   */
  topup: (choice: { packId?: string; amountNaira?: number }, returnTo = '/studio') =>
    request<{ authorizationUrl: string; reference: string }>('/api/v1/topup', {
      method: 'POST',
      body: JSON.stringify({
        ...choice,
        callbackUrl: `${window.location.origin}${returnTo}${returnTo.includes('?') ? '&' : '?'}paid=1`,
      }),
    }),

  verifyTopup: (reference: string) =>
    request<{ credited: boolean; reason?: string; balance: number }>('/api/v1/topup/verify', {
      method: 'POST',
      body: JSON.stringify({ reference }),
    }),

  generate: (tierId: string, prompt: string) =>
    request<{ generationId: string; costCredits: number; balanceAfter: number }>('/api/v1/generate', {
      method: 'POST',
      body: JSON.stringify({ tierId, prompt, feature: 'VidEngine' }),
    }),

  result: (id: string) => request<GenerationResult>(`/api/v1/predictions/${id}/result`),

  metrics: (days = 30) => request<Metrics>(`/api/v1/metrics?days=${days}`),

  planner: {
    list: () => request<{ posts: PlannedPost[]; subscription: PlannerPlan }>('/api/v1/planner'),

    schedule: (post: { scheduledFor: string; tierId: string; prompt: string; caption?: string }) =>
      request<PlannedPost>('/api/v1/planner', { method: 'POST', body: JSON.stringify(post) }),

    cancel: (id: string) => request<PlannedPost>(`/api/v1/planner/${id}`, { method: 'DELETE' }),

    subscribe: () => request<PlannerPlan>('/api/v1/planner/subscribe', { method: 'POST' }),
    unsubscribe: () => request<PlannerPlan>('/api/v1/planner/unsubscribe', { method: 'POST' }),
  },

  brand: {
    list: (type?: BrandAssetType) =>
      request<{ items: BrandAsset[] }>(`/api/v1/brand${type ? `?type=${type}` : ''}`),

    saveFromGeneration: (generationId: string, name: string, type?: BrandAssetType) =>
      request<BrandAsset>('/api/v1/brand/from-generation', {
        method: 'POST',
        body: JSON.stringify({ generationId, name, type }),
      }),

    rename: (id: string, name: string) =>
      request<BrandAsset>(`/api/v1/brand/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),

    remove: (id: string) =>
      request<{ deleted: boolean }>(`/api/v1/brand/${id}`, { method: 'DELETE' }),
  },
};
