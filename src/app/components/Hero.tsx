"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";

// Poster-style specs: the product stated like a film's metadata row.
const SPECS = [
  { value: "5 sources", label: "it reads" },
  { value: "On-chain", label: "signed proof" },
  { value: "~60 sec", label: "to a score" },
  { value: "Free", label: "no wallet" },
];

const NAME = "PATINA".split("");

/**
 * The dark-3d, movie-poster hero: a mono eyebrow, the name struck huge in caps
 * and revealed letter by letter, the claim as a tagline, and a specs row. It
 * floats over the full-bleed HeroScene, so the type sits in real light.
 *
 * GSAP drives a single entrance timeline; reduced motion skips it and the markup
 * (already the finished state) simply shows.
 */
export function Hero() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .from(".hero-eyebrow", { y: 16, opacity: 0, duration: 0.7, delay: 0.15 })
        .from(".hero-ch", { yPercent: 115, opacity: 0, duration: 0.9, stagger: 0.06 }, "-=0.2")
        .from(".hero-tagline", { y: 18, opacity: 0, duration: 0.7 }, "-=0.45")
        .from(".hero-actions > *", { y: 14, opacity: 0, duration: 0.6, stagger: 0.1 }, "-=0.4")
        .from(".hero-spec", { y: 14, opacity: 0, duration: 0.6, stagger: 0.08 }, "-=0.4")
        .from(".hero-cue", { opacity: 0, duration: 0.9 }, "-=0.2");
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <header
      ref={root}
      className="relative flex min-h-[100svh] flex-col items-center justify-center px-6 py-28 text-center"
    >
      {/* A soft dark bed under the type so it stays legible over the bright orb,
          while the outer glow, rings and motes stay untouched. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 64% 60% at 50% 50%, rgba(6,8,7,0.7) 0%, rgba(6,8,7,0.4) 44%, transparent 80%)",
        }}
      />

      <div
        className="relative z-10 flex w-full flex-col items-center"
        style={{ textShadow: "0 2px 30px rgba(4,6,5,0.55)" }}
      >
      <p className="hero-eyebrow t-label flex items-center gap-2.5 text-accent">
        <span className="rings" aria-hidden="true" />
        Proof of time · Built on Vana
      </p>

      <h1 className="hero-title mt-7 overflow-hidden" aria-label="Patina">
        {NAME.map((char, i) => (
          <span key={i} className="hero-ch inline-block" aria-hidden="true">
            {char}
          </span>
        ))}
      </h1>

      <p className="hero-tagline mt-8 max-w-[44ch] text-lg leading-relaxed text-text-2 sm:text-xl">
        Anyone can make a new account.{" "}
        <span className="text-accent-bright">Nobody can make an old one.</span>
      </p>

      <div className="hero-actions mt-10 flex flex-wrap items-center justify-center gap-3">
        <Link href="/connect" className="btn btn-primary px-7 py-4 text-base">
          See how far back you go
        </Link>
        <Link href="#reward" className="btn btn-ghost px-7 py-4 text-base">
          Why there is money in it
        </Link>
      </div>

      <div className="mt-14 flex flex-wrap items-start justify-center gap-x-10 gap-y-6">
        {SPECS.map((spec) => (
          <div key={spec.value} className="hero-spec">
            <div
              className="text-lg font-semibold text-text"
              style={{ fontFamily: "var(--font-display), sans-serif" }}
            >
              {spec.value}
            </div>
            <div className="t-label mt-1.5 text-text-4">{spec.label}</div>
          </div>
        ))}
      </div>
      </div>

      <div className="hero-cue absolute bottom-[5vh] z-10 flex flex-col items-center gap-3 text-text-4">
        <span className="t-label">Scroll</span>
        <span className="hero-scroll-track" aria-hidden="true">
          <span className="hero-scroll-dot" />
        </span>
      </div>
    </header>
  );
}
