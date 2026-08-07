"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

/**
 * One navigation, two shapes.
 *
 * Desktop gets a bar across the top, the way a website works. Phones get a
 * fixed tab bar across the bottom, the way an app works, because roughly nine
 * in ten people here are on Android and a row of links buried in a footer is
 * invisible to them.
 *
 * It exists at all because the standings and the reward pages were reachable
 * only from a footer link and a mid-page card. They may as well not have
 * existed: a section nobody can find is a section nobody reads.
 */

type Item = {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** Show in the desktop bar but not the phone bottom bar, which stays at five. */
  desktopOnly?: boolean;
};

const Rings = (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
    <circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="12" cy="12" r="1.8" fill="currentColor" />
  </svg>
);

const Plug = (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 3v6M15 3v6" />
    <path d="M6 9h12v3a6 6 0 0 1-12 0V9Z" />
    <path d="M12 18v3" />
  </svg>
);

const Chart = (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 20V12M12 20V5M19 20v-5" />
  </svg>
);

const Coin = (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="8.5" />
    <path d="M14.5 9.5a2.8 2.8 0 0 0-2.5-1.3c-1.4 0-2.4.8-2.4 1.9 0 2.6 5 1.3 5 3.9 0 1.1-1 1.9-2.5 1.9a2.9 2.9 0 0 1-2.6-1.4" />
    <path d="M12 6.6v10.8" />
  </svg>
);

const Shield = (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3 5 6v5c0 4.4 3 7.4 7 9 4-1.6 7-4.6 7-9V6l-7-3Z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

const Doc = (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 3h8l4 4v14H6V3Z" />
    <path d="M14 3v4h4" />
    <path d="M9 13h6M9 16.5h4" />
  </svg>
);

const ITEMS: Item[] = [
  { href: "/", label: "Home", icon: Rings },
  { href: "/connect", label: "Connect", icon: Plug },
  { href: "/verify", label: "Verify", icon: Shield },
  { href: "/standings", label: "Standings", icon: Chart },
  { href: "/rewards", label: "Reward", icon: Coin },
  // Developer docs. Desktop header only: it is for people integrating Patina,
  // not a core end-user action, and a sixth tab would crowd the phone bottom bar
  // (it stays reachable there from the footer). See the mobile filter below.
  { href: "/docs", label: "Docs", icon: Doc, desktopOnly: true },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppNav() {
  const pathname = usePathname() ?? "/";

  return (
    <>
      {/* ------------------------------------------------------- desktop bar */}
      <header className="sticky top-0 z-40 hidden border-b border-line bg-bg/85 backdrop-blur-md sm:block">
        <nav className="mx-auto flex h-16 max-w-[90rem] items-center justify-between gap-6 px-6">
          <Link href="/" className="t-label flex items-center gap-2.5 text-text">
            <span className="rings" aria-hidden="true" />
            Patina
          </Link>

          <div className="flex items-center gap-1">
            {ITEMS.filter((item) => item.href !== "/" && item.href !== "/connect").map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(pathname, item.href) ? "page" : undefined}
                className={`rounded-lg px-3.5 py-2 text-sm transition-colors ${
                  isActive(pathname, item.href)
                    ? "bg-panel text-text"
                    : "text-text-3 hover:text-text"
                }`}
              >
                {item.label}
              </Link>
            ))}

            <ThemeToggle className="ml-2" />

            <Link href="/connect" className="btn btn-primary ml-2 px-4 py-2 text-sm">
              Get your score
            </Link>
          </div>
        </nav>
      </header>

      {/* Phones have no top bar, so the theme switch rides top-right, clear of
          the notch and above the content. */}
      <div
        className="fixed right-3 z-40 sm:hidden"
        style={{ top: "calc(env(safe-area-inset-top) + 0.6rem)" }}
      >
        <ThemeToggle />
      </div>

      {/* -------------------------------------------------------- mobile bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 backdrop-blur-md sm:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto flex max-w-lg">
          {ITEMS.filter((item) => !item.desktopOnly).map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`press flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 py-2 ${
                    active ? "text-accent" : "text-text-3"
                  }`}
                >
                  {/* Material-style active pill behind the icon, so the current
                      tab reads at a glance the way a native bottom bar does. */}
                  <span
                    className={`flex items-center justify-center rounded-full px-4 py-0.5 transition-colors duration-200 ${
                      active ? "bg-accent-wash" : "bg-transparent"
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span className="text-[11px] font-medium leading-none">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
