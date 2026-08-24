import { evidenceOf, profileForUsername } from "@/lib/store";
import { scorePatina } from "@/lib/score";
import { checkLookupRate } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/**
 * An embeddable "Patina verified" badge, as an SVG image.
 *
 * People drop this on a personal site, a README, or an X bio with a plain
 * <img>, and it carries the brand across the whole web. It reads live, so it is
 * always current. Wrap it in a link to /verify so a click proves it is real.
 */

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c === "'" ? "&apos;" : "&quot;",
  );
}

function badgeSvg(score: number, years: number | null): string {
  const yr = years !== null && years >= 1 ? `${years}yr` : "new";
  const label = `Patina · ${score}/100 · ${yr}`;

  const padX = 12;
  const iconW = 22;
  const textStart = padX + iconW;
  // Rough width at the 12.5px semibold below; the check hugs the text end so a
  // slightly-off estimate never opens a gap or an overlap.
  const textW = Math.ceil(label.length * 7.1);
  const checkX = textStart + textW + 8;
  const width = checkX + 12 + padX;
  const height = 30;
  const mid = height / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(label)}, verified by Patina">
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="7" fill="#0d1b18" stroke="#2bb98a" stroke-opacity="0.35"/>
  <g transform="translate(${padX + 8} ${mid})">
    <circle r="7" fill="none" stroke="#2bb98a" stroke-width="1.4" opacity="0.5"/>
    <circle r="3.1" fill="#2bb98a"/>
  </g>
  <text x="${textStart}" y="${mid}" dominant-baseline="central" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-size="12.5" font-weight="600">
    <tspan fill="#eef2f0">Patina</tspan><tspan fill="#8c968f"> · </tspan><tspan fill="#2bb98a">${score}</tspan><tspan fill="#8c968f">/100 · </tspan><tspan fill="#eef2f0">${escapeXml(yr)}</tspan>
  </text>
  <g transform="translate(${checkX} ${mid})" stroke="#2bb98a" stroke-width="1.9" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M-4 0 l2.6 2.6 L4.2 -3.2"/>
  </g>
</svg>`;
}

export async function GET(request: Request, { params }: { params: Promise<{ username: string }> }) {
  // Same reasoning as /api/verify: fine one badge at a time, not as a way to
  // walk a name list and find out who exists.
  const rate = await checkLookupRate(request);
  if (!rate.allowed) {
    return new Response("Too many lookups", {
      status: 429,
      headers: { "retry-after": String(rate.retryAfterSeconds) },
    });
  }

  const { username } = await params;
  const name = decodeURIComponent(username).replace(/\.svg$/i, "");
  const profile = await profileForUsername(name);

  if (!profile || !profile.username) {
    return new Response("Not found", { status: 404 });
  }

  const score = scorePatina(evidenceOf(profile));
  const years = score.oldestSignal ? Math.floor(score.oldestSignal.years) : null;

  return new Response(badgeSvg(score.total, years), {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      // Scores change slowly; a short cache keeps embeds cheap and reasonably fresh.
      "cache-control": "public, max-age=300, s-maxage=300",
      "access-control-allow-origin": "*",
    },
  });
}
