import Link from "next/link";

/**
 * The hero, for the institutional-trust register.
 *
 * The first job of the first screen is to say plainly what Patina is and what
 * you get, so a stranger understands it in five seconds. The left carries the
 * claim in plain words and a single primary action; the right shows the actual
 * product, a Patina credential, so the page demonstrates rather than only
 * asserts.
 *
 * Server-rendered. The gentle rise-in is handled by the shared [data-rise]
 * reveal (see ScrollReveals), so the hero speaks the same one motion language
 * as the rest of the page and needs no client JavaScript of its own.
 */

const TRUST = [
  "No documents or selfies",
  "Your accounts stay yours",
  "Signed and checkable on Vana",
  "Free, about a minute",
];

function Check({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={`shrink-0 text-accent ${className}`}>
      <circle cx="10" cy="10" r="9" fill="var(--accent-wash)" stroke="var(--accent-line)" />
      <path
        d="M6 10.4 8.8 13.2 14 7.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The tree-ring mark, drawn as fine concentric linework. Quiet, never loud. */
function RingMark({ size }: { size: number }) {
  const rings = [0.14, 0.26, 0.4, 0.55, 0.71, 0.88];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" className="text-accent">
      {rings.map((r, i) => (
        <circle
          key={r}
          cx="50"
          cy="50"
          r={r * 49}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
          opacity={0.14 + i * 0.045}
        />
      ))}
      <circle cx="50" cy="50" r="1.8" fill="currentColor" opacity="0.55" />
    </svg>
  );
}

function Bar({ label, points, max }: { label: string; points: number; max: number }) {
  const pct = (points / max) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium text-text-2">{label}</span>
        <span className="tabular-nums text-text-3">
          {points}
          <span className="text-text-4">/{max}</span>
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-panel-2">
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** The product, shown. A clean, real Patina credential, not a placeholder. */
function CredentialCard() {
  return (
    <figure className="surface relative w-full overflow-hidden p-6 sm:p-7">
      <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-12 opacity-70">
        <RingMark size={190} />
      </div>

      <div className="relative flex items-center justify-between gap-4">
        <span className="t-eyebrow inline-flex items-center gap-2 text-text-3">
          <span className="rings" aria-hidden="true" />
          Patina
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-line bg-accent-wash px-2.5 py-1 text-xs font-medium text-accent-ink">
          <Check className="h-3.5 w-3.5" />
          Signed on Vana
        </span>
      </div>

      <div className="relative mt-7">
        <p className="text-sm font-medium text-text-3">Your Patina</p>
        <p className="mt-1 flex items-baseline gap-2">
          <span className="text-6xl font-semibold tracking-tight text-accent-ink tabular-nums">84</span>
          <span className="text-2xl font-semibold text-text-4">/100</span>
        </p>
        <p className="mt-1 text-lg font-semibold text-text">Deeply worn in</p>
        <p className="mt-1.5 text-sm text-text-3">Traced back to 2013 &middot; 13 years</p>
      </div>

      <div className="relative mt-6 space-y-3 border-t border-line pt-5">
        <Bar label="Age" points={38} max={40} />
        <Bar label="Corroboration" points={17} max={20} />
      </div>

      <figcaption className="relative mt-5 text-xs leading-relaxed text-text-4">
        An example credential. Yours is built from your own history.
      </figcaption>
    </figure>
  );
}

export function Hero() {
  return (
    <header className="relative overflow-hidden border-b border-line">
      {/* A very faint ring watermark: the brand mark as quiet texture. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-48 -top-48 hidden opacity-50 lg:block"
      >
        <RingMark size={640} />
      </div>

      <div className="mx-auto grid max-w-[90rem] items-center gap-12 px-6 pb-16 pt-10 sm:pt-14 lg:min-h-[calc(100svh-4rem)] lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-12">
        <div>
          <p data-rise className="t-eyebrow inline-flex items-center gap-2 text-accent-ink">
            <span className="rings" aria-hidden="true" />
            Verified humanity, built on Vana
          </p>

          <h1 data-rise className="t-hero mt-6 text-text">
            Proof you are a real person, from accounts you already own.
          </h1>

          <p data-rise className="mt-6 max-w-xl text-lg leading-relaxed text-text-2">
            Patina reads the history in the accounts you already have and turns it into a private,
            verifiable score of how far back your digital life really goes. No documents, no wallet,
            no selfie.
          </p>

          <div data-rise className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/connect" className="btn btn-primary px-7 py-3.5 text-base">
              Get your score, free
            </Link>
            <Link
              href="#how"
              className="tap text-base font-medium text-accent-ink underline-offset-4 hover:underline"
            >
              See how it works
            </Link>
          </div>

          <ul
            data-rise
            className="mt-10 grid max-w-lg grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2"
          >
            {TRUST.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm leading-relaxed text-text-3">
                <Check className="mt-0.5 h-4 w-4" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div data-rise className="w-full lg:max-w-[33rem] lg:justify-self-end">
          <CredentialCard />
        </div>
      </div>
    </header>
  );
}
