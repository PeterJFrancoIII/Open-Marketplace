import { headers } from "next/headers";
import { isAdminEmail } from "../../lib/admin-policy";
import {
  getMarketplaceAdminEmails,
  requireMarketplaceSession,
} from "../../lib/auth";
import type { PortalUser } from "./portal-shell";

export async function loadPortalSession(returnTo: string) {
  const requestHeaders = await headers();
  const session = await requireMarketplaceSession(requestHeaders, returnTo);
  const isAdmin = isAdminEmail(
    session.user.email,
    await getMarketplaceAdminEmails(),
  );
  const user: PortalUser = {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
  };
  return { requestHeaders, session, isAdmin, user };
}
