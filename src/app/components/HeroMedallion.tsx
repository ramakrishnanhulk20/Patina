"use client";

import dynamic from "next/dynamic";
import { useIsDesktop } from "./useIsDesktop";
import { VerifiedSeal } from "./VerifiedSeal";

// Desktop only, and split off so a phone never downloads three or the scene.
const HeroCoin3D = dynamic(() => import("./HeroCoin3D"), { ssr: false });

/**
 * The hero mark, hybrid by device.
 *
 * Desktop gets the real turning metal (HeroCoin3D). Phones, which are most of
 * the traffic, get the light faked version: the struck seal as flat SVG over a
 * soft verdigris light source, floating gently. Same object, right weight for
 * the device.
 */
export function HeroMedallion() {
  const isDesktop = useIsDesktop();

  return (
    <div className="relative h-full w-full">
      {/* The light the mark sits in. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(circle at 50% 46%, rgba(53,224,161,0.14), transparent 64%)",
        }}
      />
      {isDesktop ? (
        <HeroCoin3D />
      ) : (
        <div className="hero-float grid h-full place-items-center">
          <VerifiedSeal size={280} className="h-auto w-[min(64vw,17rem)]" />
        </div>
      )}
    </div>
  );
}
