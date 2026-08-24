import { ImageResponse } from "next/og";
import { evidenceOf, profileForUsername } from "@/lib/store";
import { scorePatina, verdict } from "@/lib/score";
import { SITE_URL } from "@/lib/site";

export const alt = "A Patina score card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#0B0C0B";
const ACCENT = "#35E0A1";
const TEXT = "#F3F4F3";
const MUTED = "#A8ADA8";
const FAINT = "#4B504B";

/**
 * The card somebody actually posts.
 *
 * This is the product's only real distribution. Nobody shares a link to a form,
 * but people share a number about themselves, especially one that implies they
 * have been around longer than you. So the number is enormous, the year it goes
 * back to is right underneath it, and the whole thing has to be legible as a
 * thumbnail on a phone in a group chat.
 *
 * Depth is faked with stacked, offset, semi-transparent layers rather than any
 * real 3D: ImageResponse supports a subset of CSS and no transforms worth
 * relying on, so the illusion is built from things that definitely render.
 */
export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const profile = await profileForUsername(decodeURIComponent(username));

  const score = profile ? scorePatina(evidenceOf(profile)) : scorePatina({});
  const year = score.oldestSignal ? new Date(score.oldestSignal.date).getFullYear() : null;
  const years = score.oldestSignal ? Math.floor(score.oldestSignal.years) : null;
  const name = profile?.username ?? "Patina";

  // The card carries the score; this line tells the person holding it that a
  // whole story sits behind the number, and where to find it, so even a plain
  // screenshot (no clickable link) points onward. Only when a username exists,
  // because that is the only case where the story page is real.
  const host = SITE_URL.replace(/^https?:\/\//, "");
  const storyPath = profile?.username
    ? `${host}/u/${profile.username}/story`
    : null;

  /** Stacked rings, each one offset, so the plate reads as having thickness. */
  const ring = (size: number, opacity: number, width: number) => (
    <div
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: size,
        border: `${width}px solid ${ACCENT}`,
        opacity,
      }}
    />
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: BG,
          position: "relative",
        }}
      >
        {/* The plate: layered rings bleeding off the right edge. */}
        <div
          style={{
            position: "absolute",
            right: -180,
            top: 40,
            width: 700,
            height: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {ring(680, 0.1, 2)}
          {ring(560, 0.16, 2)}
          {ring(440, 0.24, 2)}
          {ring(330, 0.34, 3)}
          {ring(230, 0.5, 3)}
          {ring(140, 0.75, 4)}
          <div style={{ position: "absolute", width: 44, height: 44, borderRadius: 44, background: ACCENT }} />
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: 72,
            width: 760,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 18,
                border: `2px solid ${ACCENT}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div style={{ width: 7, height: 7, borderRadius: 7, background: ACCENT }} />
            </div>
            <div style={{ color: MUTED, fontSize: 22, letterSpacing: 4, fontWeight: 600 }}>
              PATINA
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ color: MUTED, fontSize: 30, marginBottom: 4 }}>{name}</div>

            <div style={{ display: "flex", alignItems: "flex-end", gap: 18 }}>
              <div
                style={{
                  color: ACCENT,
                  fontSize: 210,
                  lineHeight: 1,
                  fontWeight: 700,
                  letterSpacing: -8,
                }}
              >
                {score.total}
              </div>
              <div style={{ color: FAINT, fontSize: 46, fontWeight: 600, paddingBottom: 26 }}>
                /100
              </div>
            </div>

            <div style={{ color: TEXT, fontSize: 38, fontWeight: 600, marginTop: 10 }}>
              {verdict(score)}
            </div>

            {year !== null && (
              <div style={{ color: MUTED, fontSize: 28, marginTop: 12 }}>
                Digital life traced back to {year} · {years} years
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ color: FAINT, fontSize: 24 }}>
              Anyone can make a new account. Nobody can make an old one.
            </div>
            {storyPath !== null && (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ color: ACCENT, fontSize: 24, fontWeight: 600 }}>
                  See the whole story →
                </div>
                <div style={{ color: MUTED, fontSize: 22 }}>{storyPath}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      /**
       * Let the CDN answer the unfurls.
       *
       * Every time this link is pasted into a chat, that app fetches this image
       * to build a preview. And a link that spreads gets fetched by WhatsApp,
       * Telegram, X and Slack, repeatedly, for one share. Uncached, each of
       * those is a Redis read plus a PNG render, on the request path of the
       * thing we most want to be fast.
       *
       * Ten minutes is the trade: a score that just changed is stale in
       * previews for a few minutes, and `stale-while-revalidate` means nobody
       * ever waits for the refresh. The card page itself is always live.
       */
      headers: {
        "cache-control": "public, max-age=0, s-maxage=600, stale-while-revalidate=86400",
      },
    },
  );
}
