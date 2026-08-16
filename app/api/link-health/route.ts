import { checkPaymentDestination } from "../../../lib/link-health";
import { checkSocialAccounts } from "../../../lib/social-health";
import type { PaymentDestination, SocialProof } from "../../../lib/types";

async function checkListingLinks(
  accounts: SocialProof[],
  destinations: PaymentDestination[],
) {
  const [checkedAccounts, checkedDestinations] = await Promise.all([
    checkSocialAccounts(accounts.slice(0, 3)),
    Promise.all(destinations.slice(0, 10).map(checkPaymentDestination)),
  ]);
  return {
    accounts: checkedAccounts,
    destinations: checkedDestinations,
  };
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      accounts?: SocialProof[];
      destinations?: PaymentDestination[];
    };
    if (
      (payload.accounts != null &&
        (!Array.isArray(payload.accounts) || payload.accounts.length > 3)) ||
      (payload.destinations != null &&
        (!Array.isArray(payload.destinations) || payload.destinations.length > 10))
    ) {
      return Response.json(
        { error: "Provide up to three social accounts and ten payment destinations." },
        { status: 400 },
      );
    }
    const checked = await checkListingLinks(
      payload.accounts ?? [],
      payload.destinations ?? [],
    );
    return Response.json(checked);
  } catch {
    return Response.json(
      { error: "Social and payment links could not be checked." },
      { status: 400 },
    );
  }
}
