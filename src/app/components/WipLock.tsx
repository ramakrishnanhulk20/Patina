import { WipUnlockForm } from "./WipUnlockForm";

/**
 * Full-app lock while we wait on Vana Data Pipe.
 * Shown in place of the normal shell (no nav, no app chrome).
 */
export function WipLock() {
  return (
    <main className="relative flex min-h-[100dvh] flex-1 flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(53,224,161,0.08),transparent_55%),radial-gradient(ellipse_at_80%_90%,rgba(232,154,58,0.06),transparent_45%)]"
      />

      <p className="relative mb-6 font-mono text-[11px] tracking-[0.22em] text-text-3 uppercase">
        Patina
      </p>

      <div className="relative mb-10 w-full max-w-[320px]">
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG lock art; next/image SVG config not worth it */}
        <img
          src="/wip-construction.svg"
          alt="Construction barrier and scaffolding"
          width={480}
          height={360}
          className="h-auto w-full"
        />
      </div>

      <h1 className="relative max-w-md text-[clamp(1.75rem,5vw,2.35rem)] leading-[1.15] font-semibold tracking-tight text-text">
        Work in progress
      </h1>
      <p className="relative mt-4 max-w-sm text-[15px] leading-relaxed text-text-2">
        We&apos;re paused while Vana finishes fixing profile connect. Check back soon.
      </p>

      <WipUnlockForm />
    </main>
  );
}
