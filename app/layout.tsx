import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Open Marketplace — a marketplace owned by its community",
  description:
    "A lightweight, open-source marketplace where listing media stays with sellers.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
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
