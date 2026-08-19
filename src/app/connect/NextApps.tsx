import type { EcosystemApp } from "@/lib/ecosystem";

/**
 * Portability, made a real step instead of a footnote.
 *
 * This was built for the Vana Cup, where a sign-up scored one point and data a
 * user BROUGHT being read by another app scored two. Almost nobody chased the
 * second one. Patina could, because connecting through Vana leaves the data
 * portable, and that strategy is what won the Cup: third on sign-ups, first on
 * assists by three times the runner-up.
 *
 * The competition is over and the scoring is gone, but the reason this section
 * exists never depended on it. Portable data is the entire promise Patina makes
 * on its landing page, and this is the one place a person can actually watch it
 * happen: approve a second app, and the history they just connected is already
 * there. Deleting it would remove the proof of the pitch.
 */
export function NextApps({ apps }: { apps: EcosystemApp[] }) {
  if (apps.length === 0) return null;

  return (
    <section className="mt-14 overflow-hidden rounded-2xl border border-accent/30 bg-gradient-to-b from-accent-wash to-panel">
      <div className="border-b border-line/60 p-6 sm:p-8">
        <p className="t-label flex items-center gap-2.5 text-accent">
          <span className="rings" aria-hidden="true" />
          Your data is already portable
        </p>

        <h2 className="mt-5 t-section text-text">You&apos;ve proved it. Now put it to work.</h2>

        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-text-2">
          Because you connected through Vana, your history is not stuck in Patina. Approve another
          app and it can read what you already connected, no forms, no re-linking, nothing to do
          twice.
        </p>

        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-text-3">
          This is the part worth seeing for yourself. Everywhere else on the internet, connecting an
          account to one service does nothing for the next one. Here it already did. Nobody is
          paying anybody, and none of these apps get anything from Patina beyond a user who arrives
          with their history already in hand.
        </p>
      </div>

      {/*
        grid-cols-1 is load-bearing, not redundant. A bare `grid` makes an
        implicit `auto` column that sizes to max-content, and the truncated
        (nowrap) descriptions blow that out to ~560px on a phone, overflowing
        the card and getting clipped. `grid-cols-1` is minmax(0,1fr), which
        pins the column to the container and lets the truncation actually work.
      */}
      <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 sm:p-6">
        {apps.map((app) => (
          <a
            key={app.url}
            href={app.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="press group flex items-center gap-4 rounded-xl border border-line bg-bg p-5 hover:border-accent/50"
          >
            {app.icon ? (
              // Third-party image, boxed so a broken or oversized one can never
              // define the layout.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={app.icon}
                alt=""
                width={44}
                height={44}
                loading="lazy"
                className="h-11 w-11 shrink-0 rounded-lg bg-panel-2 object-cover"
              />
            ) : (
              <span aria-hidden="true" className="h-11 w-11 shrink-0 rounded-lg bg-panel-2" />
            )}

            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-text transition-colors group-hover:text-accent">
                {app.name}
              </span>
              {app.description && (
                <span className="mt-0.5 block truncate text-sm text-text-3">{app.description}</span>
              )}
            </span>

            <span
              aria-hidden="true"
              className="shrink-0 text-text-4 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-accent"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 17 17 7M9 7h8v8" />
              </svg>
            </span>
          </a>
        ))}
      </div>

      <p className="px-6 pb-6 text-sm leading-relaxed text-text-4 sm:px-8">
        These are independent apps we have no stake in. Approve them on their own merits, and only
        share what you are comfortable sharing.
      </p>
    </section>
  );
}
