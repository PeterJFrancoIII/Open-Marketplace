/** Normalize genesis prior to empty string so UNIQUE forbids concurrent forks. */
export function normalizePriorEventHash(
  prior: string | null | undefined,
): string {
  return prior && prior.length > 0 ? prior : "";
}
