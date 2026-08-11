import Link from "next/link";
import type { ReactNode } from "react";

export type PortalUser = {
  id: string;
  name: string;
  email: string;
};

export type PortalSection =
  | "overview"
  | "listings"
  | "settings"
  | "admin";

const baseNav: { href: string; label: string; section: PortalSection }[] = [
  { href: "/account", label: "Overview", section: "overview" },
  { href: "/account#my-listings", label: "My listings", section: "listings" },
  {
    href: "/account#account-settings",
    label: "Account settings",
    section: "settings",
  },
];

export default function PortalShell({
  user,
  activeSection,
  isAdmin,
  children,
}: {
  user: PortalUser;
  activeSection: PortalSection;
  isAdmin: boolean;
  children: ReactNode;
}) {
  const navigation = isAdmin
    ? [
        ...baseNav,
        {
          href: "/admin",
          label: "Admin overview",
          section: "admin" as const,
        },
      ]
    : baseNav;

  return (
    <div className="portal-shell">
      <header className="portal-topbar">
        <Link className="wordmark" href="/" aria-label="Open Marketplace home">
          <span className="wordmark-mark">↔</span>
          <span className="wordmark-copy">open marketplace</span>
        </Link>
        <div className="portal-topbar-actions">
          <p className="portal-user-chip">
            <span className="portal-user-name">{user.name}</span>
            <span className="portal-user-email">{user.email}</span>
          </p>
          <Link className="button button-ghost portal-back" href="/">
            Back to marketplace
          </Link>
        </div>
      </header>

      <div className="portal-layout">
        <nav className="portal-nav" aria-label="Account">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`portal-nav-link${
                activeSection === item.section ? " active" : ""
              }`}
              aria-current={
                activeSection === item.section ? "page" : undefined
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <main className="portal-main">{children}</main>
      </div>
    </div>
  );
}
