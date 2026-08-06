/**
 * THE HALLMARK.
 *
 * Old silver is proven real, and dated, by a tiny assay stamp struck into the
 * metal. A mark that is trusted precisely because it is official. A Patina
 * score makes the same claim about a digital life, and every score really is
 * signed by the app's key on Vana, so it earns the same object: a struck seal,
 * not a sticker.
 *
 * What is in the mark: the growth-ring motif at the centre (the same rings in
 * the favicon and the section labels), a reeded coin edge, and the claim spelled
 * around the rim. It only ever appears where a score has actually been signed,
 * so it reads as provenance rather than chrome.
 *
 * Pure SVG. Scales to any size, tints from the accent, and announces itself to
 * assistive tech through the title.
 */
export function VerifiedSeal({
  size = 128,
  className = "",
  topText = "VERIFIED · ON VANA",
  bottomText = "AGE, PROVEN",
  title = "This score is cryptographically signed on Vana",
}: {
  size?: number;
  className?: string;
  topText?: string;
  bottomText?: string;
  title?: string;
}) {
  // A reeded coin edge: 72 fine ticks, every sixth one longer, like the graduations
  // on an assay rule. Computed rather than hand-drawn so the ring stays even.
  const ticks = Array.from({ length: 72 }, (_, i) => {
    const angle = (i / 72) * Math.PI * 2 - Math.PI / 2;
    const long = i % 6 === 0;
    const inner = long ? 51.5 : 53;
    const outer = 57;
    return {
      x1: 60 + Math.cos(angle) * inner,
      y1: 60 + Math.sin(angle) * inner,
      x2: 60 + Math.cos(angle) * outer,
      y2: 60 + Math.sin(angle) * outer,
      long,
    };
  });

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      className={className}
      style={{ color: "var(--accent)" }}
    >
      <title>{title}</title>
      <defs>
        {/* Two semicircles so rim text sits upright top AND bottom. */}
        <path id="pat-seal-top" d="M13 60 A47 47 0 0 1 107 60" fill="none" />
        <path id="pat-seal-bot" d="M13 60 A47 47 0 0 0 107 60" fill="none" />
        <radialGradient id="pat-seal-glow" cx="50%" cy="42%" r="60%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.16" />
          <stop offset="70%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* A faint verdigris bloom, so the mark looks struck into a lit surface. */}
      <circle cx="60" cy="60" r="58" fill="url(#pat-seal-glow)" />

      {/* Reeded edge. */}
      <g stroke="var(--line-strong)">
        {ticks.map((t, i) => (
          <line
            key={i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            strokeWidth={t.long ? 1.1 : 0.7}
            stroke={t.long ? "var(--text-3)" : "var(--line-strong)"}
          />
        ))}
      </g>

      {/* Rim rules that frame the struck text. */}
      <circle cx="60" cy="60" r="53.5" fill="none" stroke="var(--line-strong)" strokeWidth="0.75" />
      <circle cx="60" cy="60" r="40" fill="none" stroke="var(--line)" strokeWidth="0.75" />

      {/* Rim text, mono, letterspaced, the way a stamp is engraved. */}
      <g
        fill="var(--text-3)"
        fontFamily="var(--font-geist-mono), ui-monospace, monospace"
        fontSize="6.4"
        fontWeight={500}
        letterSpacing="1.4"
      >
        <text>
          <textPath href="#pat-seal-top" startOffset="50%" textAnchor="middle">
            {topText}
          </textPath>
        </text>
        <text fill="var(--text-4)">
          <textPath href="#pat-seal-bot" startOffset="50%" textAnchor="middle">
            {bottomText}
          </textPath>
        </text>
      </g>

      {/* The growth-ring motif at the centre, the mark itself. */}
      <g fill="none" stroke="var(--accent)" strokeWidth="1.5">
        <circle cx="60" cy="60" r="27" opacity="0.35" />
        <circle cx="60" cy="60" r="19" opacity="0.6" />
        <circle cx="60" cy="60" r="11" />
      </g>
      <circle cx="60" cy="60" r="3.6" fill="var(--accent)" />
    </svg>
  );
}
