import {
  getMarketplaceSession,
  marketplaceLoginRedirectResponse,
} from "../../lib/auth";

export async function GET(request: Request) {
  const session = await getMarketplaceSession(request);
  if (!session) {
    return marketplaceLoginRedirectResponse("/account");
  }

  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"/><title>My account — Open Marketplace</title></head><body><main><h1>My account</h1><p>Account settings and listing management land in the next batch.</p><p><a href="/">Back to marketplace</a></p></main></body></html>`,
    {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    },
  );
}
