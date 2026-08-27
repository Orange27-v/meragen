/**
 * Types for the forked studio components.
 *
 * The components themselves are JavaScript (inherited from Open-Generative-AI),
 * so this hand-written declaration is what lets the TypeScript app consume them.
 * `apiKey` is the prop name they already use — it carries a Meerah session
 * token, not a vendor key.
 */
import type { ComponentType } from 'react';

export interface StudioProps {
  /** Meerah session token. Sent as the `x-api-key` header. */
  apiKey: string;
  onGenerationStart?: (info: { tabId?: string; requestId?: string }) => void;
  onGenerationComplete?: (info: { tabId?: string; requestId?: string; url?: string }) => void;
  onGenerationError?: (message: string) => void;
}

export declare const ImageStudio: ComponentType<StudioProps>;
export declare const VideoStudio: ComponentType<StudioProps>;
export declare const ClippingStudio: ComponentType<StudioProps>;
export declare const VibeMotionStudio: ComponentType<StudioProps>;
export declare const LipSyncStudio: ComponentType<StudioProps>;
export declare const RecastStudio: ComponentType<StudioProps>;
export declare const CinemaStudio: ComponentType<StudioProps>;
export declare const AudioStudio: ComponentType<StudioProps>;
export declare const MarketingStudio: ComponentType<StudioProps>;
export declare const AiInfluencerStudio: ComponentType<StudioProps>;
export declare const LayersStudio: ComponentType<StudioProps>;
export declare const AppsStudio: ComponentType<StudioProps>;

export declare function getUserBalance(apiKey: string): Promise<{ balance: number }>;
export declare function getHistory(
  apiKey: string,
  options?: { cursor?: string; limit?: number },
): Promise<{ items: unknown[]; cursor: string | null }>;
