"use client";

import { useEffect, useState } from "react";

/**
 * Light and dark, on a switch.
 *
 * The real work is done by CSS variables that flip under `:root[data-theme]`
 * (see globals.css) and by the no-flash script in layout.tsx, which stamps the
 * right theme on <html> before the first paint. This control just flips the
 * attribute and remembers the choice.
 *
 * Two instances can be on the page at once (the desktop header and the fixed
 * mobile button), so a toggle broadcasts a small event and every instance keeps
 * its icon in sync.
 */

type Theme = "light" | "dark";

function currentTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

const Sun = (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.5v2.2M12 19.3v2.2M4.4 4.4l1.6 1.6M18 18l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.4 19.6l1.6-1.6M18 6l1.6-1.6" />
  </svg>
);

const Moon = (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.3 6.3 0 0 0 10.5 10.5Z" />
  </svg>
);

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(currentTheme());
    const sync = () => setTheme(currentTheme());
    window.addEventListener("patina-theme-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("patina-theme-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  function toggle() {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    const el = document.documentElement;
    // Suppress transitions across the flip so no colour transition sticks at the
    // old theme's value, then restore them a frame after the themed paint lands.
    el.classList.add("theme-sync");
    el.setAttribute("data-theme", next);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => el.classList.remove("theme-sync")),
    );
    try {
      localStorage.setItem("patina-theme", next);
    } catch {
      // Storage blocked. The attribute still flips for this session.
    }
    window.dispatchEvent(new Event("patina-theme-change"));
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
      className={`press inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-panel text-text-2 transition-colors hover:border-line-strong hover:text-text ${className}`}
    >
      {theme === "dark" ? Sun : Moon}
    </button>
  );
}
