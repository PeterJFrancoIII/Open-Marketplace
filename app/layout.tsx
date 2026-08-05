import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Open Marketplace — real people, real profiles, real trust",
  description:
    "A lightweight, open-source marketplace where listing media stays with sellers. Connect your world. Trade with confidence.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: [{ url: "/favicon-32.png", type: "image/png" }, { url: "/favicon.svg" }],
    shortcut: "/favicon-32.png",
    apple: "/open-marketplace-logo-256.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
