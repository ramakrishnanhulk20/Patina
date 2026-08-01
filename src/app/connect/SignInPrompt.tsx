/**
 * The optional sign-in nudge shown in place of the name editor while signed out.
 *
 * Connecting no longer requires signing in first. A person can connect a source,
 * see their score, and only then be asked to sign in to KEEP it — which converts
 * far better than a Google wall in front of any value. Signing in still folds a
 * browser-only profile into a stable Google identity (see claimProfile), so the
 * "one person, one row" property the old hard gate protected is preserved for
 * anyone who signs in; it is just no longer demanded up front.
 */
export function SignInPrompt({
  loginAvailable,
  connected,
  loginError,
}: {
  loginAvailable: boolean;
  /** True once at least one source is connected, so the ask can shift to "save it". */
  connected: boolean;
  loginError: string | null;
}) {
  return (
    <div className="border border-accent/40 bg-accent-wash p-5">
      <p className="font-semibold text-text">
        {connected ? "Save your score before you lose it" : "Sign in to keep your score"}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-text-2">
        {connected
          ? "Right now this score lives on this browser alone. Sign in with Google to keep it across every device and put it on the leaderboard."
          : "So your score belongs to you, not this browser. Connect one account first if you like — signing in keeps it on every device and gets you on the board."}
      </p>

      {loginError && <p className="mt-3 text-sm text-bad">{loginError}</p>}

      <div className="mt-4">
        {loginAvailable ? (
          <a href="/api/login" className="btn btn-primary px-5 py-2.5 text-sm">
            Continue with Google
          </a>
        ) : (
          <p className="text-sm text-warn">Sign-in is not switched on yet — you can still connect below.</p>
        )}
      </div>
    </div>
  );
}
