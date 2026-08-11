import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Geist, Geist_Mono, Space_Grotesk, Space_Mono } from "next/font/google";
import "./globals.css";
import { SiteChrome } from "./components/SiteChrome";
import { SmoothScroll } from "./components/SmoothScroll";
import { SITE_URL } from "@/lib/site";
import { isWipLocked } from "@/lib/wip-server";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Dark-3d cinematic type: a technical grotesk for the big display, a mono for
// the eyebrows and specs. Body stays Geist.
const displayFont = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

const monoDisplay = Space_Mono({
  variable: "--font-mono-display",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const DESCRIPTION =
  "Proof you're a real person. Patina reads the history already sitting in accounts you own and turns it into portable evidence a real human has been here for years. No documents, no face scan.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Patina · proof you're a real person",
    template: "%s · Patina",
  },
  description: DESCRIPTION,
  openGraph: {
    title: "Patina · proof you're a real person",
    description: DESCRIPTION,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Patina · proof you're a real person",
    description: DESCRIPTION,
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    // Lets someone who adds Patina to their home screen open it without the
    // browser chrome, which is most of what makes a web app feel like an app.
    capable: true,
    title: "Patina",
    statusBarStyle: "default",
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
  themeColor: "#f6f8f8",
  colorScheme: "light",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locked = await isWipLocked();

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${displayFont.variable} ${monoDisplay.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-bg text-text">
        {/* Stamp the saved (or system) theme on <html> before first paint, so a
            dark-mode visitor never sees a white flash on the way in. Next only
            runs an inline script this early through next/script beforeInteractive. */}
        <Script id="patina-theme-init" strategy="beforeInteractive">
          {"(function(){try{var d=document.documentElement;d.classList.add('theme-sync');var t=localStorage.getItem('patina-theme');if(t!=='light'&&t!=='dark'){t=(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';}d.setAttribute('data-theme',t);}catch(e){}})();"}
        </Script>
        {/* If JS never runs, never leave scroll-reveal content stuck hidden. */}
        <noscript>
          <style
            dangerouslySetInnerHTML={{
              __html: ".reveal{opacity:1 !important;transform:none !important}",
            }}
          />
        </noscript>
        <SmoothScroll />
        <SiteChrome locked={locked}>{children}</SiteChrome>
      </body>
    </html>
  );
}
