/**
 * A digital life, drawn as growth rings.
 *
 * The brand is tree rings — the mark that only forms by lasting — so the score's
 * signature visual is the person's history as literal concentric rings, one per
 * year, the oldest at the core. They draw themselves in from the centre out when
 * the page loads (reduced motion just shows them whole). Pure SVG, so it is
 * light on a phone and sharp at any size, unlike the WebGL card.
 */

const MAX_RINGS = 20;
const INNER_R = 15;
const OUTER_R = 102;

export function DigitalRings({
  years,
  oldestYear,
}: {
  /** Provable years of history. Null or under one renders nothing. */
  years: number | null;
  oldestYear: number | null;
}) {
  if (!years || years < 1) return null;

  const whole = Math.round(years);
  const count = Math.min(Math.max(whole, 1), MAX_RINGS);

  const rings = Array.from({ length: count }, (_, i) => {
    const r = count === 1 ? 58 : INNER_R + ((OUTER_R - INNER_R) * i) / (count - 1);
    const circumference = 2 * Math.PI * r;
    // Recent (outer) rings brightest; the old core is carried by the centre dot.
    const opacity = 0.28 + 0.72 * (count === 1 ? 1 : i / (count - 1));
    return { r, circumference, opacity, delay: i * 70 };
  });

  return (
    <figure className="text-accent">
      <svg
        viewBox="0 0 220 220"
        className="mx-auto block h-auto w-full max-w-[15rem]"
        role="img"
        aria-label={`${whole} years of provable history, drawn as ${count} growth rings`}
      >
        {/* Rotated so each ring draws from the top rather than three o'clock. */}
        <g transform="rotate(-90 110 110)">
          {rings.map((ring, i) => (
            <circle
              key={i}
              cx="110"
              cy="110"
              r={ring.r}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="ring-draw"
              style={{
                opacity: ring.opacity,
                strokeDasharray: ring.circumference,
                strokeDashoffset: ring.circumference,
                animationDelay: `${ring.delay}ms`,
              }}
            />
          ))}
        </g>
        <circle cx="110" cy="110" r="5" fill="currentColor" />
      </svg>

      <figcaption className="mt-4 text-center">
        <span className="t-mono text-3xl text-text">{whole}</span>{" "}
        <span className="t-label text-text-3">
          {whole === 1 ? "year" : "years"} · {count} {count === 1 ? "ring" : "rings"}
        </span>
        {oldestYear !== null && (
          <p className="mt-1 text-sm text-text-3">Traced back to {oldestYear}</p>
        )}
      </figcaption>
    </figure>
  );
}
