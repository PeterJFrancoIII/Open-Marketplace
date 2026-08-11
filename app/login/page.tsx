import Link from "next/link";
import { sanitizeReturnTo } from "../../lib/auth-return-to";
import LoginPanel from "./login-panel";

type SearchParams = Record<string, string | string[] | undefined>;

function readParam(params: SearchParams | undefined, key: string) {
  const value = params?.[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const resolved =
    searchParams && typeof (searchParams as Promise<SearchParams>).then === "function"
      ? await (searchParams as Promise<SearchParams>)
      : ((searchParams as SearchParams | undefined) ?? {});
  const returnTo = sanitizeReturnTo(readParam(resolved, "returnTo"));

  return (
    <div className="auth-shell">
      <header className="auth-topbar">
        <Link className="wordmark" href="/" aria-label="Open Marketplace home">
          <span className="wordmark-mark">↔</span>
          <span className="wordmark-copy">open marketplace</span>
        </Link>
      </header>
      <main className="auth-main">
        <LoginPanel returnTo={returnTo} />
      </main>
    </div>
  );
}
