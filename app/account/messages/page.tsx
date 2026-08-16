import { headers } from "next/headers";
import { getDb } from "../../../db";
import {
  getMarketplaceAdminEmails,
  requireMarketplaceSession,
} from "../../../lib/auth";
import { isAdminEmail } from "../../../lib/admin-policy";
import { listConversations, listMessages } from "../../../lib/conversations";
import PortalShell from "../../portal/portal-shell";
import MessagesClient from "./messages-client";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function readParam(params: SearchParams | undefined, key: string) {
  const value = params?.[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function MessagesPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const requestHeaders = await headers();
  const session = await requireMarketplaceSession(requestHeaders, "/account/messages");
  const adminEmails = await getMarketplaceAdminEmails();
  const isAdmin = isAdminEmail(session.user.email, adminEmails);
  const resolved =
    searchParams && typeof (searchParams as Promise<SearchParams>).then === "function"
      ? await (searchParams as Promise<SearchParams>)
      : ((searchParams as SearchParams | undefined) ?? {});
  const conversationId = readParam(resolved, "id")?.trim() ?? "";
  const db = await getDb();
  const initialInbox = await listConversations(db, session.user.id);
  const initialThread = conversationId
    ? await listMessages(db, conversationId, session.user.id)
    : null;

  return (
    <PortalShell
      user={{
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      }}
      activeSection="messages"
      isAdmin={isAdmin}
    >
      <MessagesClient
        userId={session.user.id}
        initialConversationId={initialThread ? conversationId : ""}
        initialInbox={initialInbox}
        initialThread={initialThread}
      />
    </PortalShell>
  );
}
