import { getMarketplaceAuth } from "../../../../lib/auth";

async function handle(request: Request) {
  try {
    const auth = await getMarketplaceAuth(request);
    return auth.handler(request);
  } catch {
    return Response.json(
      { error: "Authentication is temporarily unavailable." },
      { status: 503 },
    );
  }
}

export const GET = handle;
export const POST = handle;
