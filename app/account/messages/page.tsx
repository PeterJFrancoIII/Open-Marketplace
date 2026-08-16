import { getDb } from "../../../db";
import { listConversations, listMessages } from "../../../lib/conversations";
import { loadPortalSession } from "../../portal/load-portal";
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
  const { session, isAdmin, user } = await loadPortalSession("/account/messages");
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
    <PortalShell user={user} activeSection="messages" isAdmin={isAdmin}>
      <MessagesClient
        userId={session.user.id}
        initialConversationId={initialThread ? conversationId : ""}
        initialInbox={initialInbox}
        initialThread={initialThread}
      />
    </PortalShell>
  );
}
