"use client";

import { useState, useSyncExternalStore } from "react";

/**
 * Save or share the card as an actual image.
 *
 * The shareable asset already exists: the OpenGraph route renders a polished
 * 1200×630 PNG per username. This hands that file to the person directly, which
 * is the piece that was missing — a link unfurls in some apps, but people post
 * IMAGES to X and Instagram, and there was no way to get one out of here.
 *
 * On a phone it uses the Web Share file API, so the PNG goes straight into X,
 * Instagram or WhatsApp with the picker the person already knows. Where that is
 * not available (most desktops), it downloads. Same button, right behaviour for
 * the device.
 */
const noSubscribe = () => () => {};

export function SaveCard({ username }: { username: string }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);

  // Decide the label on the server-safe path, the same way ShareCard reads the
  // origin: a phone should say "Share", a desktop "Download", with no flash of
  // the wrong word on hydration.
  const canShareFiles = useSyncExternalStore(
    noSubscribe,
    () =>
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function",
    () => false,
  );

  async function fetchCard(): Promise<File> {
    const res = await fetch(`/u/${encodeURIComponent(username)}/opengraph-image`);
    if (!res.ok) throw new Error(`image ${res.status}`);
    const blob = await res.blob();
    return new File([blob], `patina-${username}.png`, { type: "image/png" });
  }

  async function run() {
    setBusy(true);
    setError(false);
    setDone(false);
    try {
      const file = await fetchCard();

      // Native file share, when the browser will take a file. Anything the user
      // does inside the sheet — including cancelling — is a success from here.
      if (canShareFiles && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "My Patina card" });
          return;
        } catch (shareError) {
          if ((shareError as Error)?.name === "AbortError") return;
          // Anything else: fall through and download instead of dead-ending.
        }
      }

      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setDone(true);
      setTimeout(() => setDone(false), 2200);
    } catch {
      setError(true);
      setTimeout(() => setError(false), 3000);
    } finally {
      setBusy(false);
    }
  }

  const label = busy
    ? "Preparing…"
    : done
      ? "Saved"
      : error
        ? "Try again"
        : canShareFiles
          ? "Share card image"
          : "Download card image";

  return (
    <button type="button" onClick={run} disabled={busy} className="btn btn-primary px-6 py-3.5 text-base">
      {label}
    </button>
  );
}
