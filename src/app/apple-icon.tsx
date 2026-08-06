import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * iOS ignores SVG favicons for the home screen and will happily fall back to a
 * screenshot of the page, so the one icon that has to be a PNG is this one.
 *
 * Drawn rather than imported: it is the same growth-ring motif as icon.svg, the
 * section labels and the social card, and generating it here means there is no
 * second binary asset to keep in step with the brand colour.
 *
 * No rounded corners and no padding. IOS applies its own mask and squeeze, and
 * anticipating them is how an icon ends up looking inset.
 */
export default function AppleIcon() {
  const ring = (diameter: number, opacity: number, width: number) => (
    <div
      style={{
        position: "absolute",
        width: diameter,
        height: diameter,
        borderRadius: diameter,
        border: `${width}px solid #2FBF90`,
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
          alignItems: "center",
          justifyContent: "center",
          background: "#0B100E",
        }}
      >
        {ring(130, 0.35, 6)}
        {ring(90, 0.6, 6)}
        {ring(51, 1, 7)}
        <div style={{ width: 20, height: 20, borderRadius: 20, background: "#2FBF90" }} />
      </div>
    ),
    size,
  );
}
