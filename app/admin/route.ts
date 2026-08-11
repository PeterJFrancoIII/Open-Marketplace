import {
  getMarketplaceAdminEmails,
  getMarketplaceSession,
  marketplaceLoginRedirectResponse,
} from "../../lib/auth";
import { isAdminEmail } from "../../lib/admin-policy";

export async function GET(request: Request) {
  const session = await getMarketplaceSession(request);
  if (!session) {
    return marketplaceLoginRedirectResponse("/admin");
  }

  const configuredEmails = await getMarketplaceAdminEmails();
  if (!isAdminEmail(session.user.email, configuredEmails)) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"/><title>Admin — Open Marketplace</title></head><body><main><h1>Admin overview</h1><p>Admin metrics land in the next batch.</p><p><a href="/">Back to marketplace</a></p></main></body></html>`,
    {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    },
  );
}
