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

const DESCRIPTION =
  "Anyone can make a new account. Nobody can make an old one. Patina reads the history you already have and turns it into proof a real person has been here for years.";

/**
 * Absolute URLs for social cards. Falls back to the live domain rather than
 * localhost, so a preview deploy that forgets the env var still produces
 * shareable links instead of ones pointing at someone's laptop.
 */
const SITE_URL = process.env.VANA_APP_URL ?? "https://patinadata.xyz";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Patina — proof you have been here a while",
    template: "%s — Patina",
  },
  description: DESCRIPTION,
  openGraph: {
    title: "Patina — proof you have been here a while",
    description: DESCRIPTION,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Patina — proof you have been here a while",
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-bg text-text">{children}</body>
    </html>
  );
}
