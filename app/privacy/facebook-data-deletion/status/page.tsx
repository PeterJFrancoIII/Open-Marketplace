import type { Metadata } from "next";
import { LegalShell } from "../../../legal/legal-shell";
import { verifyDeletionConfirmation } from "../../../../lib/facebook-data-deletion";

export const metadata: Metadata = {
  title: "Facebook deletion status — Open Marketplace",
  description:
    "Check the status of a Facebook data deletion request on Open Marketplace.",
};

type SearchParams = Record<string, string | string[] | undefined>;

function readParam(params: SearchParams | undefined, key: string) {
  const value = params?.[key];
  return Array.isArray(value) ? value[0] : value;
}

async function readFacebookSecret() {
  try {
    const { env } = (await import("cloudflare:workers")) as {
      env: { FACEBOOK_CLIENT_SECRET?: string };
    };
    return env.FACEBOOK_CLIENT_SECRET?.trim() || "";
  } catch {
    return "";
  }
}

export default async function FacebookDeletionStatusPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const resolved =
    searchParams &&
    typeof (searchParams as Promise<SearchParams>).then === "function"
      ? await (searchParams as Promise<SearchParams>)
      : ((searchParams as SearchParams | undefined) ?? {});
  const code = readParam(resolved, "code")?.trim() ?? "";
  const secret = await readFacebookSecret();
  const confirmation = verifyDeletionConfirmation(code, secret);

  return (
    <LegalShell
      title="Deletion request status"
      lead="If Facebook gave you a confirmation code after you asked this app to delete your data, check it here."
    >
      <form
        className="legal-code-form"
        method="get"
        action="/privacy/facebook-data-deletion/status"
      >
        <label htmlFor="deletion-confirmation-code">Confirmation code</label>
        <input
          id="deletion-confirmation-code"
          name="code"
          defaultValue={code}
          autoComplete="off"
          spellCheck={false}
        />
        <button className="button button-dark" type="submit">
          Check status
        </button>
      </form>

      {confirmation ? (
        <section aria-labelledby="deletion-complete-title">
          <h2 id="deletion-complete-title">This request is complete</h2>
          <p>
            Confirmation <code>{confirmation.confirmationCode}</code> was
            accepted. Facebook Login data for that request was removed when we
            received it. The Open Marketplace email account was not deleted.
          </p>
        </section>
      ) : (
        <section aria-labelledby="deletion-unknown-title">
          <h2 id="deletion-unknown-title">
            {code ? "This code was not recognized" : "No confirmation code yet"}
          </h2>
          <p>
            {code
              ? "That code is not a confirmation we issued. Check the link Facebook provided, or sign in and choose Disconnect in Account settings."
              : "Paste the code Facebook gave you, or sign in and choose Disconnect in Account settings."}
          </p>
        </section>
      )}
    </LegalShell>
  );
}
