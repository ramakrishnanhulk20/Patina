import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SectionLabel } from "../components/SectionLabel";
import { ClaimPanel } from "./ClaimPanel";
import { REWARD, claimPageLive } from "@/lib/rewards";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Claim your share",
  description:
    "Patina won the Vana Cup. A share of the winnings goes back to the people who connected early. If you were in the top 50 when the standings froze, claim your place here.",
};

/**
 * The claim page.
 *
 * This used to be the reward pitch for a competition Patina had not yet won.
 * It won, so the pitch is gone and what remains is the part that is actually
 * owed: who qualified, what they get, and where to put a wallet address.
 *
 * Everything that made this page a marketing surface (the running Cup position,
 * the points explainers, the leaderboard) has been removed. A site still
 * advertising a contest it already finished reads as one nobody is maintaining,
 * and worse, it keeps inviting people into something they can no longer enter.
 */
export default function RewardsPage() {
  /**
   * Gone the moment the window shuts.
   *
   * Not a "closed" banner: there is nothing left to do here, and a page that
   * still looks like a claim form invites somebody to paste an address that
   * will never be read. The route is enforced here rather than only hidden in
   * the nav, so a saved link or a search result lands on a 404 too.
   */
  if (!claimPageLive()) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10 sm:px-6 sm:py-14">
      <SectionLabel>Reward</SectionLabel>

      <h1 className="t-section mt-5 text-text">Patina won. Claim your place.</h1>

      <p className="mt-5 text-lg leading-relaxed text-text-2">
        Patina finished <span className="text-text">{REWARD.finished}</span> in the Vana Cup on{" "}
        {REWARD.snapshotAt}, with {REWARD.finalPoints.toLocaleString()} points. A share of the
        winnings goes back to the people who connected early, across the top {REWARD.places} by
        points.
      </p>

      {/*
        The compliance notice, stated before anything else a claimant reads.
        Burying the one term that changed under the mechanics would be the
        dishonest way to present this, so it goes first and it goes big.
      */}
      <section className="mt-6 rounded-lg border-2 border-accent/60 bg-panel p-5 sm:p-6">
        <p className="t-label text-accent">Important, please read</p>
        <h2 className="mt-3 text-lg font-semibold tracking-tight text-text sm:text-xl">
          The reward amount is determined solely by the builder.
        </h2>
        <div className="mt-3 space-y-3 leading-relaxed text-text-2">
          <p>
            Rewards here are virtual assets, and the tax and compliance obligations on them fall on
            Patina rather than on you. The real cost of settling is not known until this window
            closes and the number of valid claims is final, so{" "}
            <span className="text-text">no amount, share or percentage is published</span> on this
            site, and any figure quoted anywhere previously no longer applies.
          </p>
          <p>
            <span className="text-text">You will be told your own amount directly</span> once the
            window has closed and the position is worked out. Submitting your address below secures
            your place; it does not fix a number, and no number is implied by it.
          </p>
        </div>
      </section>

      {/*
        The deadline goes above the panel, not buried in the explainer below it.
        Somebody who reads one thing on this page has to read this one, because
        it is the only part that expires.
      */}
      <p className="mt-4 rounded-lg border border-accent/40 bg-accent-wash px-4 py-3 text-base leading-relaxed text-text">
        <span className="font-semibold">Claims close after 12 hours.</span> The window runs{" "}
        {REWARD.windowLabel}. An address not submitted before it closes cannot be paid.
      </p>

      <div className="mt-8">
        <ClaimPanel />
      </div>

      <section className="mt-12 border-t border-line pt-8">
        <h2 className="text-xl font-semibold tracking-tight text-text">How it works</h2>
        <ul className="mt-4 space-y-3 text-text-2">
          <li className="flex gap-3">
            <span className="text-accent">1.</span>
            <span>
              The standings were frozen at the final whistle on {REWARD.snapshotAt}. Ranking is by
              points, which is your Patina score plus what you brought in. Connecting after that
              date does not change eligibility, which is the point of freezing it.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-accent">2.</span>
            <span>
              The claim window is{" "}
              <span className="text-text">{REWARD.windowLabel}</span>, and it is 12 hours long. The
              panel above shows it in your own timezone with a live countdown.{" "}
              <span className="text-text">
                An address not submitted before it closes cannot be paid.
              </span>
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-accent">3.</span>
            <span>
              After the window closes, each person who claimed in time is contacted directly with
              their own amount. Settlement follows once the tax and compliance position is worked
              out, and no date is promised here rather than one being promised and missed.
            </span>
          </li>
        </ul>
      </section>

      <section className="mt-10 rounded-lg border border-line bg-panel p-6">
        <h2 className="text-lg font-semibold tracking-tight text-text">Read this before you paste anything</h2>
        <p className="mt-3 leading-relaxed text-text-2">
          Patina will <span className="text-text">never</span> ask for a seed phrase, a private key,
          a signature, or a connection to your wallet. The only thing ever needed is a public
          address, the one you would give somebody to send you funds. Anyone asking you for more
          than that, in a DM or anywhere else, is not us.
        </p>
        <p className="mt-3 leading-relaxed text-text-3">
          Your address is stored against your profile, is never shown publicly, and is not returned
          by any public API. You can change it any time before payout.
        </p>
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/connect" className="btn btn-primary px-6 py-3.5 text-base">
          Get your score
        </Link>
        <Link href="/terms" className="btn btn-ghost px-6 py-3.5 text-base">
          Terms
        </Link>
      </div>
    </main>
  );
}
