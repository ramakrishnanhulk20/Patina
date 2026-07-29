"use client";

import { useEffect } from "react";

/**
 * When something server-side falls over.
 *
 * The realistic cause is Redis: every page that shows a score, a rank or the
 * standings reads from it, and a blip there used to surface as Next's stock
 * error page. Somebody who had just connected an account would conclude their
 * data had gone, which is precisely the fear this product exists to answer.
 *
 * So the copy does one job: say plainly that nothing was lost. `unstable_retry`
 * re-fetches on the server rather than merely re-rendering, which is what a
 * transient store failure actually needs.
 */
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // The digest is the only handle we have on a production stack trace, so it
    // goes to the log where it can be matched up later.
    console.error("[patina] render failed", error.digest ?? "", error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-5 py-16 sm:px-6 sm:py-24">
      <p className="t-label flex items-center gap-2.5 text-text-3">
        <span className="rings" aria-hidden="true" />
        Something broke
      </p>

      <h1 className="t-section mt-5 text-text">That did not load.</h1>

      <p className="mt-5 text-lg leading-relaxed text-text-2">
        A problem on our side, not yours.{" "}
        <span className="text-text">Nothing you connected has been lost</span> — your score is
        stored against your account, not against this page.
      </p>

      <div className="mt-9 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="btn btn-primary px-6 py-3.5 text-base"
        >
          Try again
        </button>
        <a href="/connect" className="btn btn-ghost px-6 py-3.5 text-base">
          Back to your score
        </a>
      </div>

      {error.digest && (
        <p className="t-mono mt-8 text-xs text-text-4">
          Reference {error.digest} — quote this if you tell us about it.
        </p>
      )}
    </main>
  );
}
