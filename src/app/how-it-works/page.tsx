import Link from "next/link";
import { SectionLabel } from "../components/SectionLabel";
import { SourceGlyph } from "../components/SourceGlyph";
import { CORE_ORDER, SOURCE_SPECS, STRENGTHEN_ORDER } from "@/lib/sources";
import { scorePatina } from "@/lib/score";

export const metadata = {
  title: "How it works",
  description:
    "What Patina reads from each account, what it keeps, and what the number actually means.",
};

/**
 * The page for the person being scored, as opposed to /docs, which is for the
 * app doing the checking.
 *
 * It exists because Vana's approval page enumerates every requested scope by
 * name, in language we did not write, on a domain that is not ours. Somebody
 * about to read "Connections", "Experience" and "Education" on that page needs
 * to have read what we actually take out of them first. The connect flow shows
 * this per source at the moment of asking; this is the same promise in one
 * place, linkable, and readable before anybody has committed to anything.
 *
 * The weights are read from the scorer rather than typed here, so a change to
 * score.ts cannot leave this page quietly describing the old one.
 */
const COMPONENTS = scorePatina({}).components;

const COMPONENT_WHY: Record<string, string> = {
  age: "The single oldest date anything you connect can prove. Twelve years earns full marks. It is the biggest row and still not half the score, because one old date is the one thing somebody could buy.",
  continuity:
    "How many separate months you actually showed up in, and what share of your whole span that covers. Both matter: perfect attendance over six months is still six months, and one busy year inside a decade is somebody who passed through.",
  corroboration:
    "How many unrelated accounts independently agree on when you started. Each counts for how old it is, so three accounts opened last Tuesday agree about nothing.",
  vouches:
    "When other people chose to connect to you, not how many did. A bought follower has no date on it; a connection made in 2016 required somebody else to act, in 2016.",
  depth:
    "Posts, repositories, orders, saved tracks. Real but limited, and discounted when it all arrived in one burst rather than across the years.",
  breadth:
    "Independent accounts backing each other up. Faking one is easy. Faking six, each with its own history, is a different job.",
};

const LIMITS = [
  {
    title: "It cannot prove you are a person",
    body: "Patina reports how much history it can see behind accounts you own. That is evidence, and good evidence, but it is not a certificate that you are human. If an app needs to know you are exactly one living person right now, Patina is the wrong tool and says so.",
  },
  {
    title: "A low score is not an accusation",
    body: "Young accounts score low. So do private ones, and quiet ones, and anybody who has only ever used two services. None of that is suspicious and none of it is a judgement about you. A low score means we cannot see much, not that there is nothing there.",
  },
  {
    title: "Aged accounts can be bought",
    body: "They can. What that does is turn a free attack into an expensive one whose price climbs with every year and every extra platform. It does not make it impossible, and anybody telling you their sybil check is impossible to beat is selling something.",
  },
  {
    title: "Signing in proves control, not ownership",
    body: "Vana Desktop asks you to sign in on your own machine, which proves whoever is at that machine holds the credentials. A bought account comes with its password. This moves the bar a long way up from typing a username, and it is still not the same word as owning it.",
  },
];

export default function HowItWorksPage() {
  const sources = [...CORE_ORDER, ...STRENGTHEN_ORDER].map((id) => SOURCE_SPECS[id]);
  const scopeCount = sources.reduce((sum, source) => sum + source.scopes.length, 0);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-14 sm:py-20">
      <SectionLabel>How it works</SectionLabel>

      <h1 className="t-section mt-5 text-text">What Patina reads, and what it keeps.</h1>

      <p className="mt-7 text-lg leading-relaxed text-text-2">
        Patina turns the history in accounts you already own into a number somebody else can check.
        This page is the whole of it: what gets read, what survives, what the number means, and
        where it stops being true.
      </p>

      <p className="mt-4 text-lg leading-relaxed text-text-2">
        If you are building against it rather than being scored by it, the{" "}
        <Link href="/docs" className="text-accent underline underline-offset-4">
          developer docs
        </Link>{" "}
        are the other half.
      </p>

      {/* ------------------------------------------------------- the mechanism */}
      <section className="mt-16">
        <SectionLabel>Connecting</SectionLabel>
        <h2 className="mt-4 text-2xl font-semibold text-text">
          Your accounts sign in on your computer, not on ours.
        </h2>

        <p className="mt-5 leading-relaxed text-text-2">
          Connecting runs through <strong className="text-text">Vana Desktop</strong>, an app that
          opens a browser window on your own machine and asks you to sign in to the account you are
          connecting. That sign-in happens locally. Patina never sees a password, never holds a
          token, and cannot sign in as you afterwards.
        </p>

        <p className="mt-4 leading-relaxed text-text-2">
          What comes back goes to your own Personal Server on Vana, and Patina pays a small fee to
          read the parts you approved, once. You can revoke that access at any time, and deleting
          your Patina profile takes everything we derived from it with it.
        </p>

        <div className="mt-6 border-l-2 border-accent-line bg-panel py-3 pl-4 pr-4">
          <p className="text-sm leading-relaxed text-text-2">
            The old version of Patina read public pages from a username you typed, which meant
            anybody could type anybody&apos;s. This one cannot be done on somebody else&apos;s
            behalf, which is the whole reason it now needs a computer.
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------ the score */}
      <section className="mt-16">
        <SectionLabel>The number</SectionLabel>
        <h2 className="mt-4 text-2xl font-semibold text-text">
          Six things, weighted by how hard they are to fake.
        </h2>

        <p className="mt-5 leading-relaxed text-text-2">
          Everything here is expensive in <em className="not-italic text-text">time</em> rather than
          in money. Follower counts are the most purchasable number on the internet, so they are
          worth about two points out of a hundred, and we would rather say that than pretend
          otherwise.
        </p>

        <dl className="mt-8 divide-y divide-line border-y border-line">
          {COMPONENTS.map((component) => (
            <div key={component.key} className="flex flex-wrap gap-x-8 gap-y-2 py-5">
              <dt className="flex min-w-[9rem] items-baseline gap-3">
                <span className="font-semibold text-text">{component.label}</span>
                <span className="t-mono text-sm text-text-4">{component.max}</span>
              </dt>
              <dd className="max-w-[46ch] flex-1 leading-relaxed text-text-2">
                {COMPONENT_WHY[component.key]}
              </dd>
            </div>
          ))}
        </dl>

        <p className="mt-6 leading-relaxed text-text-2">
          The last three are <strong className="text-text">gated</strong> behind the first three.
          Somebody can open six accounts, upload a thousand things and buy three thousand followers
          in an afternoon, so volume and breadth only count to the extent that real elapsed time
          sits underneath them. There is a floor, though: a nineteen-year-old with a genuine
          three-year account is not a fraud and is never scored as one.
        </p>
      </section>

      {/* ------------------------------------------------------- read and keep */}
      <section className="mt-16">
        <SectionLabel>Every source</SectionLabel>
        <h2 className="mt-4 text-2xl font-semibold text-text">
          {scopeCount} things asked for, and what is left after.
        </h2>

        <p className="mt-5 leading-relaxed text-text-2">
          Every one of these is requested for its <strong className="text-text">dates</strong>. The
          content that arrives attached is not wanted, is not scored, and is thrown away before
          anything is written down. The second line under each is the one that matters.
        </p>

        <p className="mt-4 leading-relaxed text-text-2">
          Timestamps themselves are rounded to the month before they are stored. Knowing you saved
          twelve tracks in March 2019 tells us what we need; knowing the exact minute tells us
          things that are none of our business.
        </p>

        <div className="mt-10 flex flex-col gap-10">
          {sources.map((source) => (
            <article key={source.id}>
              <div className="flex items-center gap-3.5">
                <SourceGlyph id={source.id} />
                <div>
                  <h3 className="text-lg font-semibold text-text">{source.label}</h3>
                  <p className="text-sm text-text-3">{source.blurb}</p>
                </div>
              </div>

              {source.thirdParty && (
                <p className="mt-4 border-l-2 border-warn/50 pl-3 text-sm leading-relaxed text-text-2">
                  {source.thirdParty}
                </p>
              )}

              <ul className="mt-4 flex flex-col gap-3.5">
                {source.scopes.map((scope) => (
                  <li key={scope.id} className="border-l border-line pl-4">
                    <p className="t-label text-text-3">{scope.vanaLabel}</p>
                    <p className="mt-1 text-sm leading-relaxed text-text-2">{scope.reads}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-accent">{scope.keeps}</p>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      {/* ----------------------------------------------------------- the floor */}
      <section className="mt-16">
        <SectionLabel>Before it is shareable</SectionLabel>
        <h2 className="mt-4 text-2xl font-semibold text-text">
          Patina will not sign a thin score.
        </h2>

        <p className="mt-5 leading-relaxed text-text-2">
          Below three connected sources, or fewer than two carrying a date, you still get your
          number and the full breakdown behind it. What you do not get is a public page, a badge, or
          a signature. A score built on one account tells whoever is checking it almost nothing, and
          every weak credential in circulation makes the strong ones worth less.
        </p>

        <p className="mt-4 leading-relaxed text-text-2">
          Anything marked provisional should be read as{" "}
          <em className="not-italic text-text">not enough evidence either way</em>, never as a
          warning about the person.
        </p>
      </section>

      {/* --------------------------------------------------------- honest limits */}
      <section className="mt-16">
        <SectionLabel>Where it stops</SectionLabel>
        <h2 className="mt-4 text-2xl font-semibold text-text">What Patina does not prove.</h2>

        <div className="mt-8 flex flex-col gap-7">
          {LIMITS.map((limit) => (
            <div key={limit.title}>
              <h3 className="font-semibold text-text">{limit.title}</h3>
              <p className="mt-1.5 max-w-[62ch] leading-relaxed text-text-2">{limit.body}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-16 flex flex-wrap gap-3 border-t border-line pt-10">
        <Link href="/connect" className="btn btn-primary px-6 py-3 text-base">
          Get your score
        </Link>
        <Link href="/privacy" className="btn btn-ghost px-6 py-3 text-base">
          Privacy and deletion
        </Link>
      </div>
    </main>
  );
}
