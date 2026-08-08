/**
 * Required D1 batch statement order for first-time OAuth persistence.
 * Grants reference social_connections; D1 checks FKs per statement in a batch.
 */
export const OAUTH_PERSIST_BATCH_ORDER = [
  "profiles",
  "social_connections",
  "provider_grants",
] as const;
