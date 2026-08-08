type GlowCard3DProps = {
  username: string;
  score: number;
  verdict: string;
  year: number | null;
  years: number | null;
  children: React.ReactNode;
};

/**
 * A thin frame around the credential card.
 *
 * It used to force a fixed aspect ratio for a tilting WebGL plate. That plate
 * was dropped in the move to the calmer institutional register, and the leftover
 * aspect box then quietly CLIPPED the taller text card on desktop: the score,
 * verdict and year overflowed a 16/10 box at the sidebar width and were cut off.
 * So it now just carries positioning, and PlateCard sizes to its own content.
 * PlateCard is the real card and brings its own border, rounding and clipping.
 */
export function GlowCard3D({ children }: GlowCard3DProps) {
  return <div className="relative w-full">{children}</div>;
}
