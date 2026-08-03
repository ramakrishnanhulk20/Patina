/**
 * THE PROVENANCE LINE.
 *
 * The age claim as a picture instead of a sentence. A spine runs from the oldest
 * date Patina can prove up to today, one tick a year, the ends marked. The point
 * is to make the DISTANCE felt: a line that starts in 2011 and runs to now is a
 * more convincing thing than the number 14.
 *
 * This is the museum-label reading of the same fact the concentric rings show
 * organically — deliberately flatter and more archival, because a credential
 * should look measured, not decorative.
 *
 * Server-rendered, no client cost. Returns nothing when there is no datable
 * history to draw, so a young or private profile never shows an empty rule.
 */
export function ProvenanceTimeline({
  oldestYear,
  years,
}: {
  oldestYear: number | null;
  years: number | null;
}) {
  const now = new Date().getFullYear();
  if (oldestYear === null || years === null || years < 1 || oldestYear > now) return null;

  const span = Math.max(1, now - oldestYear);
  // A tick per year. Capped implicitly by how few years a digital life spans, so
  // there is no need to thin them out — the density itself reads as duration.
  const ticks = Array.from({ length: span + 1 }, (_, i) => i);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="t-label text-text-4">Traced history</span>
        <span className="t-label text-accent">{years} years</span>
      </div>

      <div className="relative mt-4 h-6">
        {/* The spine, drawn in the accent to read as proven ground. */}
        <div className="absolute inset-x-1 top-1/2 h-px -translate-y-1/2 bg-accent/45" />

        {ticks.map((i) => {
          const pct = (i / span) * 100;
          const end = i === 0 || i === span;
          return (
            <span
              key={i}
              className="absolute top-1/2 -translate-y-1/2"
              style={{ left: `calc(${pct}% )` }}
            >
              <span
                className={`block -translate-x-1/2 rounded-full ${
                  end ? "h-2.5 w-2.5 bg-accent" : "h-1 w-1 bg-accent/40"
                }`}
              />
            </span>
          );
        })}
      </div>

      <div className="mt-1.5 flex items-baseline justify-between">
        <span className="t-mono text-sm font-semibold text-accent">{oldestYear}</span>
        <span className="t-mono text-sm text-text-3">now</span>
      </div>
    </div>
  );
}
