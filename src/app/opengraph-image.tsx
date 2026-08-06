import { ImageResponse } from "next/og";

/**
 * The card people see when the link is pasted into X, Telegram or WhatsApp.
 *
 * This matters more here than on most sites. Distribution is the whole game,
 * the audience is mostly on phones, and a link with no image renders as a grey
 * box that nobody taps. The metadata already declared summary_large_image, so
 * without this file we were promising a picture and shipping nothing.
 *
 * Deliberately plain drawing: ImageResponse supports only a subset of CSS, so
 * this is flexbox, blocks and borders rather than anything clever.
 */

export const alt =
  "Patina, anyone can make a new account, nobody can make an old one";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#0B100E";
const ACCENT = "#2FBF90";
const TEXT = "#EEF2F0";
const MUTED = "#B4BDB9";

/** The growth-rings motif, redrawn with plain divs. */
function Rings() {
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

  return (
    <div
      style={{
        position: "absolute",
        right: -150,
        top: 120,
        width: 620,
        height: 620,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {ring(600, 0.14, 2)}
      {ring(460, 0.2, 2)}
      {ring(330, 0.3, 2)}
      {ring(210, 0.45, 3)}
      {ring(110, 0.7, 3)}
      <div
        style={{
          position: "absolute",
          width: 34,
          height: 34,
          borderRadius: 34,
          background: ACCENT,
        }}
      />
    </div>
  );
}

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: BG,
          padding: 76,
          position: "relative",
        }}
      >
        <Rings />

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: 20,
              border: `2px solid ${ACCENT}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{ width: 8, height: 8, borderRadius: 8, background: ACCENT }}
            />
          </div>
          <div
            style={{
              color: TEXT,
              fontSize: 24,
              letterSpacing: 4,
              fontWeight: 600,
            }}
          >
            PATINA
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", maxWidth: 780 }}>
          <div
            style={{
              color: TEXT,
              fontSize: 68,
              lineHeight: 1.05,
              letterSpacing: -2,
              fontWeight: 700,
            }}
          >
            Anyone can make a new account.
          </div>
          <div
            style={{
              color: ACCENT,
              fontSize: 68,
              lineHeight: 1.05,
              letterSpacing: -2,
              fontWeight: 700,
            }}
          >
            Nobody can make an old one.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ color: MUTED, fontSize: 26 }}>
            How far back does your digital life go?
          </div>
          <div style={{ color: "#7C8681", fontSize: 26 }}>·</div>
          <div style={{ color: MUTED, fontSize: 26 }}>patinadata.xyz</div>
        </div>
      </div>
    ),
    size,
  );
}
