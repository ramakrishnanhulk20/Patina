type GlowCard3DProps = {
  username: string;
  score: number;
  verdict: string;
  year: number | null;
  years: number | null;
  children: React.ReactNode;
};

/**
 * Frames the credential card in its aspect box.
 *
 * The tilting WebGL plate that used to live here was dropped in the move to the
 * calmer institutional register: a crisp, still credential reads as more
 * trustworthy than a spinning one, and it costs no three.js on the page a
 * stranger opens from a link in a chat. PlateCard is the real content and
 * renders cleanly in both light and dark.
 */
export function GlowCard3D({ children }: GlowCard3DProps) {
  return (
    <div className="relative aspect-[5/4] w-full overflow-hidden rounded-2xl sm:aspect-[16/10]">
      {children}
    </div>
  );
}
