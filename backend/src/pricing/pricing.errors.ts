/**
 * Raised when a quote would sell below the configured margin floor.
 *
 * This is deliberately an exception rather than a warning. A vendor price rise
 * that puts a tier underwater should stop sales on that tier and page someone,
 * not quietly keep taking orders at a loss — that is exactly how the Premium 4K
 * tier went negative in the modelling (planning.md §6).
 */
export class MarginFloorBreachError extends Error {
  constructor(
    readonly tierId: string,
    readonly realisedMargin: number,
    readonly floor: number,
    readonly costKobo: number,
    readonly retailKobo: number,
  ) {
    super(
      `Tier '${tierId}' would sell at ${(realisedMargin * 100).toFixed(1)}% margin, ` +
        `below the ${(floor * 100).toFixed(1)}% floor ` +
        `(cost ₦${(costKobo / 100).toFixed(2)}, retail ₦${(retailKobo / 100).toFixed(2)})`,
    );
    this.name = 'MarginFloorBreachError';
  }
}

/** Raised when a tier names a model we have never synced a price for. */
export class UnpricedModelError extends Error {
  constructor(readonly tierId: string, readonly modelId: string) {
    super(`Tier '${tierId}' is pinned to '${modelId}', which has no synced price`);
    this.name = 'UnpricedModelError';
  }
}
