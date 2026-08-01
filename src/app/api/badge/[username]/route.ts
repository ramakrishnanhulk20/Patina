import { evidenceOf, profileByUsername } from "@/lib/store";
import { scorePatina } from "@/lib/score";

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
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="7" fill="#0b0c0b" stroke="#35e0a1" stroke-opacity="0.35"/>
  <g transform="translate(${padX + 8} ${mid})">
    <circle r="7" fill="none" stroke="#35e0a1" stroke-width="1.4" opacity="0.5"/>
    <circle r="3.1" fill="#35e0a1"/>
  </g>
  <text x="${textStart}" y="${mid}" dominant-baseline="central" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-size="12.5" font-weight="600">
    <tspan fill="#f3f4f3">Patina</tspan><tspan fill="#6c716c"> · </tspan><tspan fill="#35e0a1">${score}</tspan><tspan fill="#6c716c">/100 · </tspan><tspan fill="#f3f4f3">${escapeXml(yr)}</tspan>
  </text>
  <g transform="translate(${checkX} ${mid})" stroke="#35e0a1" stroke-width="1.9" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M-4 0 l2.6 2.6 L4.2 -3.2"/>
  </g>
</svg>`;
}

export async function GET(_request: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const name = decodeURIComponent(username).replace(/\.svg$/i, "");
  const profile = await profileByUsername(name);

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
