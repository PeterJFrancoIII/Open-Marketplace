import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Open Marketplace — a marketplace owned by its community",
  description:
    "An independent classifieds site. Browse without an account. Listing photographs stay with sellers.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/open-marketplace-app-icon.png",
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
