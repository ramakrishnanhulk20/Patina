import { CountUp } from "./CountUp";

/**
 * The card as real HTML.
 *
 * This is not a placeholder. It renders on the server, it is what a crawler and
 * a screen reader read, and it is what stays on screen for anyone whose browser
 * will not start WebGL — which on this page means every Android WebView with
 * hardware acceleration off, and both the Instagram and Facebook in-app
 * browsers on a bad day. Those people arrived from a shared link, so they are
 * the exact audience the page exists for.
 *
 * The previous version had none of this: the whole card was an `aria-hidden`
 * canvas over a `sr-only` paragraph, so a failed context left a blank 360px
 * box, and the page carried no visible heading at all.
 */
export function PlateCard({
  username,
  score,
  verdict,
  year,
  years,
  animate = false,
}: {
  username: string;
  score: number;
  verdict: string;
  year: number | null;
  years: number | null;
  /**
   * Count the score up on first paint. Only the connect result asks for this —
   * the moment the number is earned. The shared /u card and the base beneath the
   * desktop WebGL plate stay static, so a profile view never re-animates.
   */
  animate?: boolean;
}) {
  return (
    <div className="relative flex h-full w-full flex-col justify-between overflow-hidden rounded-2xl border border-line bg-[#0e100e] p-6 sm:p-8">
      {/* Growth rings, echoing the favicon and the social card. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-8 -top-8 h-56 w-56 sm:right-4 sm:top-4"
      >
        {[0.06, 0.1, 0.15, 0.22, 0.32, 0.5].map((opacity, index) => (
          <span
            key={opacity}
            className="absolute rounded-full border border-accent"
            style={{
              opacity,
              inset: `${index * 18}px`,
            }}
          />
        ))}
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-16 bottom-0 h-64 w-64 rounded-full bg-accent/10 blur-3xl"
      />

      <p className="t-label relative text-text-3">Patina</p>

      <div className="relative mt-6">
        <p className="truncate text-xl font-semibold text-text sm:text-2xl">{username}</p>

        <p className="mt-1 flex items-baseline gap-2">
          {animate ? (
            <CountUp value={score} className="t-display text-accent" />
          ) : (
            <span className="t-display text-accent">{score}</span>
          )}
          <span className="text-2xl font-semibold text-text-4">/100</span>
        </p>

        <p className="mt-1 text-lg font-semibold text-text sm:text-xl">{verdict}</p>

        {year !== null && (
          <p className="mt-2 text-sm text-text-2">
            Traced back to {year}
            {years !== null ? ` · ${years} years` : ""}
          </p>
        )}
      </div>
    </div>
  );
}
