export function sanitizeReturnTo(value: string | null | undefined) {
  if (!value) return "/account";
  if (!value.startsWith("/") || value.startsWith("//")) return "/account";
  if (value.startsWith("/api/auth") || value.startsWith("/login")) return "/account";
  try {
    const parsed = new URL(value, "https://open-marketplace.invalid");
    if (parsed.origin !== "https://open-marketplace.invalid") return "/account";
    if (parsed.pathname.startsWith("//")) return "/account";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/account";
  }
}
