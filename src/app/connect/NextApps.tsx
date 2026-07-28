import type { EcosystemApp } from "@/lib/ecosystem";

/**
 * Where to spend the data you just connected.
 *
 * Shown only after somebody has connected something, because before that it is
 * an advert and afterwards it is genuinely useful: they have done the setup
 * once and every other app on the network now works without repeating it.
 *
 * The panel says outright that we benefit. A recommendation with a motive
 * should declare the motive, and this one survives being declared.
 */
export function NextApps({ apps }: { apps: EcosystemApp[] }) {
  if (apps.length === 0) return null;

  return (
    <section className="mt-14 border-t border-line pt-10">
      <p className="t-label flex items-center gap-2.5 text-text-3">
        <span className="rings" aria-hidden="true" />
        Now the setup is done once
      </p>

      <h2 className="mt-5 text-2xl font-semibold tracking-tight text-text sm:text-3xl">
        Your data works in these too, without doing any of that again.
      </h2>

      <p className="mt-4 max-w-2xl leading-relaxed text-text-2">
        That is the whole point of connecting through Vana rather than signing up
        somewhere. These are other apps built on the same protocol, by other people,
        and they can read what you have already connected once you approve them.
      </p>

      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-3">
        Being straight about the motive: Patina earns competition points when data
        its users brought gets used elsewhere, so we would rather you went and used
        them. You get more out of the setup, they get a user, we get points. Nobody
        here is paying anybody.
      </p>

      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        {apps.map((app) => (
          <a
            key={app.url}
            href={app.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="group flex gap-4 border border-line bg-panel p-5 transition-colors hover:border-accent/40"
          >
            {app.icon ? (
              // Third-party image, so it is boxed and never allowed to define
              // the layout. A broken one leaves a tidy empty square.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={app.icon}
                alt=""
                width={40}
                height={40}
                loading="lazy"
                className="h-10 w-10 shrink-0 rounded-lg bg-panel-2 object-cover"
              />
            ) : (
              <span
                aria-hidden="true"
                className="h-10 w-10 shrink-0 rounded-lg bg-panel-2"
              />
            )}

            <span className="min-w-0">
              <span className="block font-semibold text-text group-hover:text-accent">
                {app.name}
              </span>
              {app.description && (
                <span className="mt-1 block text-sm leading-relaxed text-text-3">
                  {app.description}
                </span>
              )}
            </span>
          </a>
        ))}
      </div>

      <p className="mt-5 text-sm text-text-4">
        These are independent apps we have no connection to. Approve them on their own
        merits, and only share what you are comfortable sharing.
      </p>
    </section>
  );
}
