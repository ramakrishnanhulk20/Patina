"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ThemeToggle } from "../ThemeToggle";

/**
 * The landing's floating pill nav. Frosted glass, a shadow that deepens once the
 * page moves, links that scroll to the in-page sections, the theme toggle (the
 * app's top bar is hidden on the landing, so the toggle lives here), and the one
 * primary action.
 *
 * On phones the section links collapse; the brand, the toggle and the call to
 * action stay, which is all a thumb needs.
 */

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#score", label: "The score" },
  { href: "#devs", label: "For developers" },
  { href: "#pricing", label: "Pricing" },
];

function RingMark() {
  return (
    <svg width="21" height="21" viewBox="0 0 20 20" aria-hidden="true" className="text-accent">
      <g fill="none" stroke="currentColor">
        <circle cx="10" cy="10" r="8.6" strokeOpacity="0.28" />
        <circle cx="10" cy="10" r="5.7" strokeOpacity="0.5" />
        <circle cx="10" cy="10" r="2.9" strokeOpacity="0.75" />
      </g>
      <circle cx="10" cy="10" r="1.3" fill="currentColor" />
    </svg>
  );
}

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="sticky top-0 z-[60] flex justify-center px-4 pt-4 sm:pt-5">
      <nav
        className="glass flex max-w-full items-center gap-1.5 rounded-full border border-line py-2 pl-4 pr-2 transition-shadow duration-300"
        style={{ boxShadow: scrolled ? "var(--shadow-lg)" : "var(--shadow)" }}
      >
        <Link
          href="/"
          className="flex items-center gap-2 pr-1 text-[1.05rem] font-semibold tracking-tight text-text"
        >
          <RingMark />
          Patina
        </Link>

        <span className="mx-1.5 hidden h-5 w-px bg-line lg:block" />

        <div className="hidden items-center gap-0.5 lg:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="tap rounded-full px-3 py-1.5 text-sm font-medium text-text-2 transition-colors hover:text-accent-ink"
            >
              {link.label}
            </a>
          ))}
        </div>

        <ThemeToggle className="ml-1" />

        <Link href="/connect" className="btn btn-primary ml-0.5 px-4 py-2 text-sm">
          Get your score
        </Link>
      </nav>
    </div>
  );
}
