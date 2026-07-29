import Link from "next/link";
import { RingField } from "./components/RingField";
import { SectionLabel } from "./components/SectionLabel";
import { ILLUSTRATION, REWARD, usd } from "@/lib/rewards";

const SOURCES = [
  { name: "YouTube", reads: "The day your account was opened", note: "Google sign-in" },
  { name: "Instagram", reads: "How far back your posts go", note: "Posts" },
  { name: "GitHub", reads: "When you joined and what you have built", note: "Profile" },
  { name: "LinkedIn", reads: "Another independent account, and who knows you", note: "Profile" },
  { name: "Spotify", reads: "A listening life", note: "Profile" },
];

const SIGNALS = [
  {
    name: "Age",
    weight: "40",
    body: "The oldest date we can prove across everything you connect. A YouTube account opened in 2013 is thirteen years you cannot go back and manufacture.",
  },
  {
    name: "Corroboration",
    weight: "20",
    body: "Two unrelated platforms both saying you have been here since 2012. One old account can be bought. Two, on different services, is a much more expensive thing to arrange.",
  },
  {
    name: "Depth",
    weight: "20",
    body: "The things you actually made. Posts, videos, repositories. Tedious to fake at volume, so it counts, but it counts less than time.",
  },
  {
    name: "Standing",
    weight: "10",
    body: "Other people and organisations treating you as real. Weighted lowest on purpose, because followers are the easiest thing on this list to buy.",
  },
  {
    name: "Breadth",
    weight: "10",
    body: "Independent accounts telling the same story. Faking one is easy. Faking four, each with its own decade behind it, is a different job entirely.",
  },
];

const STEPS = [
  {
    step: "01",
    title: "Connect one account",
    body: "Sign in with Google, Apple or an email code. No wallet, no download, no seed phrase. Start with one source and add more if you want a higher score.",
  },
  {
    step: "02",
    title: "We read only what you approve",
    body: "Your data lives in your own store, not ours. You approve a specific list, we read it once, and you can revoke it at any time. We never see a password.",
  },
  {
    step: "03",
    title: "You get a number, and it travels",
    body: "A score out of a hundred, broken down so you can argue with it. Other apps can check it without you doing any of this again.",
  },
];

const LIMITS = [
  {
    title: "It cannot prove you are a person",
    body: "It reports how much real history it can see. A high score means a long, messy, human-looking trail. That is evidence, not a certificate, and anyone telling you otherwise is selling something.",
  },
  {
    title: "A low score is not an accusation",
    body: "If you are nineteen, or you keep your accounts private, or you simply do not post much, you will score low and you are not doing anything wrong. Absence of evidence is exactly that.",
  },
  {
    title: "Someone could buy an old account",
    body: "Aged accounts do get sold. That costs real money, and the price climbs with age, which is rather the point. It turns a free attack into an expensive one. It does not make it impossible.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-bg">
      {/* ---------------------------------------------------------------- hero */}
      <header className="relative isolate overflow-hidden border-b border-line">
        <RingField />

        {/* Keeps the type legible over the brightest part of the ring field. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-bg/30 via-bg/60 to-bg"
        />

        {/*
          The hero owns exactly one screen. It used to run past the fold, so a
          first-time visitor met a half-finished sentence and no buttons, which
          is the worst possible opening for a page whose whole job is to earn
          enough trust to hand over an account.
        */}
        <div className="relative mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-6xl flex-col px-6 pb-10 pt-6">
          <div className="flex flex-1 flex-col justify-center py-10">
            <h1 className="t-hero max-w-[62rem] text-text">
              Anyone can make a new account.
              <br />
              <span className="text-accent">Nobody can make an old one.</span>
            </h1>

            {/* Vertical rhythm scales with the window so a short laptop screen
                tightens up instead of pushing the buttons out of sight. */}
            <p className="mt-[clamp(1.25rem,3vh,2rem)] max-w-xl text-lg leading-relaxed text-text-2">
              Patina reads the history you already have, from accounts you already own, and turns it
              into proof that a real person has been here for years. Nothing is stored. You approve
              exactly what it sees, and you can take it back whenever you want.
            </p>

            <div className="mt-[clamp(1.5rem,3.5vh,2.5rem)] flex flex-wrap items-center gap-3">
              <Link href="/connect" className="btn btn-primary px-6 py-3.5 text-base">
                See how far back you go
              </Link>
              <Link href="#reward" className="btn btn-ghost px-6 py-3.5 text-base">
                Why there is money in it
              </Link>
            </div>

            <p className="t-label mt-[clamp(1.25rem,2.5vh,2rem)] text-text-4">
              Free · Takes about a minute · No wallet needed
            </p>
          </div>

          {/* Tells you there is more without shouting about it. */}
          <Link
            href="#how"
            aria-label="Skip to how it works"
            className="t-label hidden self-start text-text-4 transition hover:text-accent sm:block"
          >
            Scroll
          </Link>
        </div>
      </header>

      {/* ------------------------------------------------------------ the claim */}
      <section className="border-b border-line px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <SectionLabel>The one thing that cannot be bought</SectionLabel>

          <div className="mt-8 grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
            <h2 className="t-section text-text">
              Followers can be bought. Posts can be bulk uploaded. Time cannot.
            </h2>

            <div className="space-y-5 text-lg leading-relaxed text-text-2">
              <p>
                Somebody running a thousand fake accounts can buy every signal the internet normally
                uses to decide whether you are real. Followers, activity, a filled-in profile. All
                of it is for sale.
              </p>
              <p>
                What they cannot buy is a decade. So Patina scores the things that only exist
                because time passed, and treats everything else as nearly worthless until there is
                real history sitting underneath it.
              </p>
            </div>
          </div>

          <div className="mt-16 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-5">
            {SIGNALS.map((signal) => (
              <div key={signal.name} className="bg-bg p-6">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-lg font-semibold text-text">{signal.name}</h3>
                  <span className="t-mono text-sm text-accent">{signal.weight}</span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-text-3">{signal.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------- how */}
      <section id="how" className="border-b border-line px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <SectionLabel>How it works</SectionLabel>

          <div className="mt-10 grid gap-10 lg:grid-cols-3 lg:gap-14">
            {STEPS.map((item) => (
              <div key={item.step} className="border-t border-line-strong pt-6">
                <span className="t-mono text-sm text-accent">{item.step}</span>
                <h3 className="mt-4 text-2xl font-semibold tracking-tight text-text">
                  {item.title}
                </h3>
                <p className="mt-3 leading-relaxed text-text-2">{item.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-16">
            <p className="t-label text-text-3">What it can read today</p>
            <div className="mt-5 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-5">
              {SOURCES.map((source) => (
                <div key={source.name} className="bg-bg p-6">
                  <h4 className="text-base font-semibold text-text">{source.name}</h4>
                  <p className="mt-2 text-sm leading-relaxed text-text-2">{source.reads}</p>
                  <p className="t-label mt-4 text-text-4">{source.note}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- reward */}
      <section id="reward" className="border-b border-line px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <SectionLabel>Why there is money in it</SectionLabel>

          <div className="mt-8 grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
            <h2 className="t-section text-text">
              Half of anything Patina wins goes back to the people who made it happen.
            </h2>

            <div className="space-y-5 text-lg leading-relaxed text-text-2">
              <p>
                Patina is competing in the Vana Cup, a public contest scored on a live leaderboard.
                If it places, half the winnings are split among the{" "}
                <span className="text-text">top {REWARD.places} people by points</span>
                — your Patina score plus 10 for every real person you bring. Everyone eligible gets
                one share, and every real invite adds another share of the pool.
              </p>
              <p>
                Paid in VANA by <span className="text-text">{REWARD.paidBy}</span>.
              </p>
              <p className="text-base text-text-3">
                Being straight with you: second place pays a tenth of first, and if Patina finishes
                sixth there is nothing to split at all. The leaderboard is public, so you can check
                where it stands whenever you like. This is a thing we either pull off together or we
                do not.
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
            <div className="bg-bg p-6">
              <p className="t-label text-text-3">If Patina wins</p>
              <p className="mt-3 text-2xl font-semibold text-accent">
                about {usd(ILLUSTRATION.championPerShare)}
              </p>
              <p className="t-mono mt-1 text-sm text-text-3">
                ~{Math.round(ILLUSTRATION.championPerShare)} VANA per share
              </p>
            </div>
            <div className="bg-bg p-6">
              <p className="t-label text-text-3">If Patina is 2nd to 5th</p>
              <p className="mt-3 text-2xl font-semibold text-text">
                about {usd(ILLUSTRATION.runnerUpPerShare)}
              </p>
              <p className="t-mono mt-1 text-sm text-text-3">
                ~{Math.round(ILLUSTRATION.runnerUpPerShare)} VANA per share
              </p>
            </div>
            <div className="bg-bg p-6">
              <p className="t-label text-text-3">The full rules</p>
              <Link
                href="/rewards"
                className="tap mt-3 inline-block text-lg text-accent underline underline-offset-4"
              >
                Read the terms
              </Link>
              <p className="mt-1.5 text-sm text-text-3">Including how it can go wrong</p>
            </div>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-text-4">
            Dollar figures assume {REWARD.places} shares and a VANA price of $
            {REWARD.vanaUsd.toFixed(2)} on {REWARD.priceAsOf}. The reward is paid in VANA and its
            price moves, so treat these as a sense of scale rather than a quote.
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------- limits */}
      <section className="border-b border-line px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <SectionLabel>What Patina cannot do</SectionLabel>

          <div className="mt-10 grid gap-10 lg:grid-cols-3 lg:gap-14">
            {LIMITS.map((item) => (
              <div key={item.title} className="border-t border-line-strong pt-6">
                <h3 className="text-xl font-semibold tracking-tight text-text">{item.title}</h3>
                <p className="mt-3 leading-relaxed text-text-2">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- cta */}
      <section className="px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl text-center">
          <h2 className="t-section mx-auto max-w-3xl text-text">
            How far back does your digital life actually go?
          </h2>
          <div className="mt-10">
            <Link href="/connect" className="btn btn-primary px-8 py-4 text-base">
              Find out
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-line px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-4">
          <span className="t-label flex items-center gap-2.5 text-text-3">
            <span className="rings" aria-hidden="true" />
            Patina
          </span>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href="/standings" className="tap t-label text-text-3 transition hover:text-text">
              Standings
            </Link>
            <Link href="/rewards" className="tap t-label text-text-3 transition hover:text-text">
              Reward terms
            </Link>
            <p className="t-label text-text-4">Built on Vana · Your data stays yours</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
