import type { Metadata } from "next";
import "./globals.css";

const LOGO_PATH = "/open-marketplace-logo.png";

function siteOrigin(): URL {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL || process.env.CF_PAGES_URL;
  if (fromEnv) {
    try {
      return new URL(fromEnv);
    } catch {
      // Fall through to the public Pages origin.
    }
  }
  return new URL("https://open-marketplace-demo.pages.dev");
}

export const metadata: Metadata = {
  metadataBase: siteOrigin(),
  title: {
    default: "Open Marketplace",
    template: "%s",
  },
  applicationName: "Open Marketplace",
  description:
    "An independent classifieds site. Browse without an account. Listing photographs stay with sellers.",
  icons: {
    icon: [{ url: LOGO_PATH, type: "image/png" }],
    apple: [{ url: LOGO_PATH, type: "image/png" }],
    shortcut: LOGO_PATH,
  },
  openGraph: {
    type: "website",
    siteName: "Open Marketplace",
    title: "Open Marketplace",
    description:
      "An independent classifieds site. Browse without an account. Listing photographs stay with sellers.",
    images: [
      {
        url: LOGO_PATH,
        width: 1448,
        height: 1086,
        alt: "Open Marketplace",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Open Marketplace",
    description:
      "An independent classifieds site. Browse without an account. Listing photographs stay with sellers.",
    images: [LOGO_PATH],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
