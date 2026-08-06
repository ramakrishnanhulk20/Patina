import Link from "next/link";
import { SectionLabel } from "../components/SectionLabel";
import { CupStanding } from "../components/CupStanding";
import { ILLUSTRATION, REWARD, usd } from "@/lib/rewards";

export const metadata = {
  title: "Reward rules",
  description:
    "How Patina's reward works: who qualifies, how the pool is split, when it is paid, and what happens if Patina does not place.",
};

const RULES: { heading: string; body: React.ReactNode }[] = [
  {
    heading: "What is being shared",
    body: (
      <>
        Patina is competing in the Vana Cup, a public competition run by the Vana Foundation that
        closes on {REWARD.cupClosesAt}. If Patina finishes in the top five, it wins a prize paid in
        VANA. <strong className="text-text">Half of whatever Patina wins</strong> is shared with the
        people who connected their accounts.
      </>
    ),
  },
  {
    heading: "If Patina does not place, there is nothing to share",
    body: (
      <>
        This is the part worth reading twice. The reward comes out of winnings that do not exist
        yet. If Patina finishes sixth or lower, the pool is zero and nobody is paid anything. The
        Vana Cup leaderboard is public, so you can check where Patina actually stands at any time
        rather than taking our word for it.
      </>
    ),
  },
  {
    heading: "Who is eligible",
    body: (
      <>
        The <strong className="text-text">top {REWARD.places} people by points</strong> at the moment
        the competition closes. Points are your Patina score plus 10 for every real person you
        bring. Your Patina score is built only from the history in the accounts you connect; referrals
        never change it. The full breakdown is shown to you, so nothing about your position is
        hidden.
      </>
    ),
  },
  {
    heading: "How points and the split work",
    body: (
      <>
        Each qualified invite adds <strong className="text-text">10 points</strong> toward the top{" "}
        {REWARD.places}, and that is the whole of what it does, it is the climb. Everyone who
        finishes inside the top {REWARD.places} takes an{" "}
        <strong className="text-text">equal share</strong> of the pool, one each, whether they got
        there on the strength of their own history or by bringing real people in. Inviting more does
        not buy a bigger slice; it helps you reach a place and hold it. The pool is split evenly
        between the people in those {REWARD.places} places, and nobody outside them is paid.
      </>
    ),
  },
  {
    heading: "Why invited accounts have to score something",
    body: (
      <>
        A reward attached to a referral link is an open invitation to register a hundred empty
        accounts. Requiring an invited person to reach {REWARD.referralQualifiesAt} makes that
        pointless: a throwaway account made last week scores about 2, while a genuine account
        belonging to somebody in their late teens scores around 30. Spotting that difference is the
        entire product, so it would be strange not to use it here.
      </>
    ),
  },
  {
    heading: "One person, counted once",
    body: (
      <>
        Eligibility is tracked against the underlying accounts you connect, not against a browser or
        a wallet. Clearing your cookies and starting again does not make you a second person,
        because it is still the same YouTube channel or the same GitHub username. Connecting the
        same account from several browsers counts once.
      </>
    ),
  },
  {
    heading: "When it is paid",
    body: (
      <>
        By <strong className="text-text">{REWARD.paidBy}</strong>. The Vana Foundation pays prizes
        within 30 days of the competition closing, and we pay out once we have been paid. If their
        payment is delayed, ours is too, and we will say so publicly rather than go quiet.
      </>
    ),
  },
  {
    heading: "How you get paid",
    body: (
      <>
        Patina never asks for a wallet address in order to give you a score, and you should be wary
        of anything that does. If there is a pool to share, eligible people are asked for a payout
        address at that point and not before. Patina will never ask for a private key, a seed
        phrase, or a payment of any kind. Nobody legitimate ever will.
      </>
    ),
  },
  {
    heading: "Things that would void a share",
    body: (
      <>
        Fabricated or purchased accounts, automated signups, and attempts to farm referrals with
        accounts under a single person&apos;s control. The Vana Cup disqualifies entrants for this, so
        anyone doing it is not only taking from the other participants, they are putting the whole
        pool at risk.
      </>
    ),
  },
  {
    heading: "What we cannot control",
    body: (
      <>
        The Vana Foundation runs the competition and its rules govern it. They may change dates,
        recalculate standings, or cancel the competition, and the value of VANA moves on its own.
        The share is stated in VANA rather than in dollars for that reason. Read their{" "}
        <a
          href="https://builders.vana.org/#terms"
          target="_blank"
          rel="noreferrer"
          className="text-accent underline underline-offset-4"
        >
          official competition terms
        </a>
        .
      </>
    ),
  },
];

export default function RewardsPage() {
  const round = (n: number) => Math.round(n);

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-6 sm:py-14">
      <SectionLabel>Reward rules</SectionLabel>

      <h1 className="t-section mt-5 text-text">
        Half of anything Patina wins goes back to the people who made it happen.
      </h1>

      <p className="mt-6 text-lg leading-relaxed text-text-2">
        These are the full rules, in plain English, with the uncomfortable parts left in. Last
        updated 28 July 2026.
      </p>

      {/* The numbers, before the prose, because this is what people came for. */}
      <div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
        <div className="bg-panel p-6">
          <p className="t-label text-text-3">If Patina wins the Cup</p>
          <p className="t-mono mt-3 text-3xl text-accent">
            ~{round(ILLUSTRATION.championPerShare)} VANA
          </p>
          <p className="mt-1.5 text-lg text-text-2">about {usd(ILLUSTRATION.championPerShare)}</p>
          <p className="mt-2 text-sm text-text-3">per share</p>
        </div>
        <div className="bg-panel p-6">
          <p className="t-label text-text-3">If Patina finishes 2nd to 5th</p>
          <p className="t-mono mt-3 text-3xl text-text">
            ~{round(ILLUSTRATION.runnerUpPerShare)} VANA
          </p>
          <p className="mt-1.5 text-lg text-text-2">about {usd(ILLUSTRATION.runnerUpPerShare)}</p>
          <p className="mt-2 text-sm text-text-3">per share</p>
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-text-3">
        Those figures assume all {REWARD.places} places are filled and the pool is split equally
        between them, so each is a rough per-person amount rather than a promise; with fewer than{" "}
        {REWARD.places} eligible people the pool divides fewer ways and each slice is larger. Second
        place pays a tenth of first place because the Cup prize itself does. Dollar figures use a VANA
        price of ${REWARD.vanaUsd.toFixed(2)} on {REWARD.priceAsOf} and are shown only to give you a
        sense of scale. The share itself is paid in VANA, and its price moves.
      </p>

      {/*
        None of the above pays out unless Patina places, and the terms promise
        people can check that whenever they like. Here is that check, live, 
        the honest "where does it actually stand right now".
      */}
      <div className="mt-8">
        <CupStanding />
      </div>

      <div className="mt-12 divide-y divide-line border-y border-line">
        {RULES.map((rule, index) => (
          <details key={rule.heading} open={index === 0} className="group">
            <summary className="flex cursor-pointer list-none items-center gap-3 py-5 [&::-webkit-details-marker]:hidden">
              <span className="t-mono shrink-0 text-sm text-accent">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="flex-1 text-lg font-semibold tracking-tight text-text sm:text-xl">
                {rule.heading}
              </span>
              <span
                aria-hidden="true"
                className="shrink-0 text-text-3 transition-transform group-open:rotate-45"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
            </summary>
            <p className="pb-6 leading-relaxed text-text-2 sm:pl-9">{rule.body}</p>
          </details>
        ))}
      </div>

      <div className="mt-16 border-t border-line pt-8">
        <p className="leading-relaxed text-text-3">
          Questions, or think something here is unfair? Say so publicly in the{" "}
          <a
            href="https://discord.gg/vanaofficial"
            target="_blank"
            rel="noreferrer"
            className="text-accent underline underline-offset-4"
          >
            Vana Discord
          </a>{" "}
          where we cannot quietly ignore it.
        </p>

        <Link href="/connect" className="btn btn-primary mt-8 inline-block px-6 py-3.5 text-base">
          Get your score
        </Link>
      </div>
    </main>
  );
}
