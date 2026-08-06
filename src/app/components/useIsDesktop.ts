"use client";

import { useEffect, useState } from "react";

/**
 * True on desktop-width viewports. Starts false so the server render and the
 * first client paint agree, and phones never flip it. Used to gate the heavy
 * WebGL hero: phones get the light faked version instead.
 */
export function useIsDesktop(query = "(min-width: 1024px)"): boolean {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [query]);
  return isDesktop;
}
