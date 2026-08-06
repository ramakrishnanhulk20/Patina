import Link from "next/link";
import { SectionLabel } from "../components/SectionLabel";

/**
 * What a signed-out person sees on /connect. Nothing else.
 *
 * Showing four Connect buttons to somebody who has not signed in was the wrong
 * order twice over. It let them build a score welded to one browser, which is
 * how a phone and a laptop became two half-finished people. And it opened with
 * four decisions when the only decision that matters first is one.
 *
 * A server component on purpose: signed out is known before render, so there is
 * no flash of the wrong screen and nothing to hydrate.
 */
export function SignInGate({
  loginAvailable,
  loginError,
}: {
  loginAvailable: boolean;
  loginError: string | null;
}) {
  return (
    <div className="mx-auto w-full max-w-md">
      <SectionLabel>Step one of two</SectionLabel>

      <h1 className="t-section mt-5 text-text">Sign in, then connect.</h1>

      <p className="mt-5 text-lg leading-relaxed text-text-2">
        So your score belongs to you and not to this browser. Sign in on your phone, add another
        account on your laptop, and it stays one score under one name.
      </p>

      {loginError && (
        <p className="mt-6 border border-bad/40 bg-bad/5 p-4 text-sm leading-relaxed text-bad">
          {loginError}
        </p>
      )}

      <div className="mt-8">
        {loginAvailable ? (
          <a href="/api/login" className="btn btn-primary w-full px-6 py-4 text-base">
            Continue with Google
          </a>
        ) : (
          <p className="border border-warn/40 bg-warn/5 p-4 text-sm leading-relaxed text-warn">
            Sign-in is not switched on yet. Check back shortly.
          </p>
        )}
      </div>

      <ul className="mt-8 space-y-3">
        {[
          "We ask Google for your account id. Nothing else, not your email or name.",
          "No wallet, no seed phrase, no app to download.",
          "Your accounts stay in your own store. We keep only your score, and you can revoke access anytime.",
        ].map((line) => (
          <li key={line} className="flex gap-3 text-sm leading-relaxed text-text-3">
            <span className="rings mt-1 shrink-0" aria-hidden="true" />
            {line}
          </li>
        ))}
      </ul>

      <p className="mt-8 text-sm leading-relaxed text-text-4">
        Curious what it measures first?{" "}
        <Link href="/" className="text-accent underline underline-offset-4">
          Read how the score works
        </Link>
        , or the{" "}
        <Link href="/privacy" className="text-accent underline underline-offset-4">
          privacy policy
        </Link>
        .
      </p>
    </div>
  );
}
