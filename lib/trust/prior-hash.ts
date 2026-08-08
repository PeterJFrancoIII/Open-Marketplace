/** Normalize genesis prior to empty string so UNIQUE forbids concurrent forks. */
export function normalizePriorEventHash(
  prior: string | null | undefined,
): string {
  return prior && prior.length > 0 ? prior : "";
}

/** Alias for event-id linkage column / envelope priorEventId. */
export const normalizePriorEventId = normalizePriorEventHash;

/**
 * Convert a stored genesis sentinel ('') to the omitted form used by the signer.
 * Non-empty values pass through unchanged.
 */
export function priorForEnvelope(
  prior: string | null | undefined,
): string | undefined {
  return prior && prior.length > 0 ? prior : undefined;
}
