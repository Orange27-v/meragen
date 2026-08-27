/** Raised when a charge would take a balance below zero. */
export class InsufficientCreditsError extends Error {
  constructor(
    readonly required: number,
    readonly available: number,
  ) {
    super(`Insufficient credits: needed ${required}, have ${available}`);
    this.name = 'InsufficientCreditsError';
  }
}

/** Raised when a refund is attempted against a generation already refunded. */
export class AlreadyRefundedError extends Error {
  constructor(readonly generationId: string) {
    super(`Generation ${generationId} has already been refunded`);
    this.name = 'AlreadyRefundedError';
  }
}
