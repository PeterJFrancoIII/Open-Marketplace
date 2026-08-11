export function isAdminEmail(email: string, configuredEmails: string): boolean {
  const normalized = email.trim().toLowerCase();
  return configuredEmails
    .split(",")
    .map((candidate) => candidate.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalized);
}
