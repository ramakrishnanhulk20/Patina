import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppNav } from "./components/AppNav";
import { SITE_URL } from "@/lib/site";

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
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    // Lets someone who adds Patina to their home screen open it without the
    // browser chrome, which is most of what makes a web app feel like an app.
    capable: true,
    title: "Patina",
    statusBarStyle: "black-translucent",
  },
};

/**
 * VIEWPORT-FIT=COVER IS LOAD-BEARING, not a flourish.
 *
 * Next's default viewport tag omits it, and without it iOS reports
 * `env(safe-area-inset-*)` as 0. Both the fixed mobile tab bar and the body
 * padding that clears it are written against that variable, so on every notch
 * iPhone the tab bar sat under the home indicator and the last row of content
 * was clipped. This one line is what makes those insets real.
 *
 * `themeColor` matches the page ground so Android Chrome's address bar and iOS
 * Safari's chrome stop rendering a pale strip against a near-black page.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0c0b",
  colorScheme: "dark",
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
      <body className="flex min-h-full flex-col bg-bg text-text">
        <AppNav />
        {/* Clears the fixed mobile tab bar so nothing sits underneath it. */}
        <div className="flex flex-1 flex-col pb-[calc(56px+env(safe-area-inset-bottom))] sm:pb-0">
          {children}
        </div>
      </body>
    </html>
  );
}
