import Link from "next/link";
import type { ReactNode } from "react";

const legalLinks = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy/facebook-data-deletion", label: "Facebook data deletion" },
] as const;

export function LegalShell({
  title,
  lead,
  children,
}: {
  title: string;
  lead: string;
  children: ReactNode;
}) {
  return (
    <div className="legal-shell">
      <a className="privacy-skip" href="#legal-content">
        Skip to document
      </a>
      <header className="legal-topbar">
        <Link className="wordmark" href="/" aria-label="Open Marketplace home">
          <span className="wordmark-mark">↔</span>
          <span className="wordmark-copy">open marketplace</span>
        </Link>
        <nav className="legal-nav" aria-label="Legal">
          {legalLinks.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="legal-main">
        <article className="legal-doc privacy-doc" id="legal-content">
          <header className="legal-masthead">
            <p className="legal-kicker">Open Marketplace</p>
            <h1>{title}</h1>
            <p className="legal-lead">{lead}</p>
          </header>
          {children}
          <footer className="legal-colophon">
            <p>
              Operated by Peter J. Franco III. Open Marketplace is independent
              of Meta, Facebook, Instagram, and TikTok.
            </p>
            <p>
              <Link href="/">Back to the marketplace</Link>
            </p>
          </footer>
        </article>
      </main>
    </div>
  );
}
