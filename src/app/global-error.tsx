"use client";

import { useEffect } from "react";

/**
 * The last resort: the root layout itself failed.
 *
 * This file REPLACES the document, so it gets none of the app. No globals.css,
 * no Geist, no nav. Everything it needs is inlined here. That is not a style
 * choice; anything imported would be a second thing that could fail on the
 * page whose whole job is to work when other things have failed.
 *
 * Deliberately still on brand, because a stark white system-font error page on
 * a product asking people to connect real accounts reads as "this site is
 * broken and possibly not trustworthy", which is worse than the outage.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[patina] root layout failed", error.digest ?? "", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "#0b0c0b",
          color: "#f3f4f3",
          colorScheme: "dark",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
          WebkitFontSmoothing: "antialiased",
        }}
      >
        <title>Something broke · Patina</title>

        <div style={{ maxWidth: "34rem" }}>
          <div
            aria-hidden="true"
            style={{
              width: 11,
              height: 11,
              borderRadius: 999,
              border: "1px solid #2bb98a",
              position: "relative",
              marginBottom: 24,
            }}
          >
            <span
              style={{
                position: "absolute",
                inset: 3,
                borderRadius: 999,
                background: "#2bb98a",
                display: "block",
              }}
            />
          </div>

          <h1
            style={{
              fontSize: "clamp(2rem, 7vw, 3rem)",
              lineHeight: 1.02,
              letterSpacing: "-0.03em",
              fontWeight: 600,
              margin: 0,
            }}
          >
            Patina is having a moment.
          </h1>

          <p style={{ marginTop: 20, fontSize: 18, lineHeight: 1.6, color: "#a8ada8" }}>
            Something failed before the page could load. Nothing you connected has been lost.
          </p>

          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{
              marginTop: 32,
              minHeight: 44,
              padding: "14px 24px",
              borderRadius: 8,
              border: "none",
              background: "#2bb98a",
              color: "#070807",
              fontSize: 16,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>

          {error.digest && (
            <p style={{ marginTop: 32, fontSize: 12, color: "#444844" }}>
              Reference {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
