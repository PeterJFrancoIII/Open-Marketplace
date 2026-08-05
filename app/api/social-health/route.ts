import { checkSocialAccounts } from "../../../lib/social-health";
import type { SocialProof } from "../../../lib/types";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { accounts?: SocialProof[] };
    if (!Array.isArray(payload.accounts) || payload.accounts.length > 3) {
      return Response.json(
        { error: "Provide up to three social accounts." },
        { status: 400 },
      );
    }
    const accounts = await checkSocialAccounts(payload.accounts);
    return Response.json({ accounts });
  } catch {
    return Response.json(
      { error: "Social accounts could not be checked." },
      { status: 400 },
    );
  }
}
