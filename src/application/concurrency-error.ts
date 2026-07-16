/**
 * Optimistic concurrency failure — second writer lost the version race.
 * API layer maps this to HTTP 409 with code BUDGET_CONFLICT.
 */
export class ConcurrencyConflictError extends Error {
  readonly code = "BUDGET_CONFLICT" as const;

  constructor(
    message = "This budget was modified by another user. Refresh and try again."
  ) {
    super(message);
    this.name = "ConcurrencyConflictError";
  }
}
