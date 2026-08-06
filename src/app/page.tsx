import Link from "next/link";
import { Hero } from "./components/Hero";
import { HeroScene } from "./components/HeroScene";
import { ScrollReveals } from "./components/ScrollReveals";
import { SourceGlyph } from "./components/SourceGlyph";
import { VerifiedSeal } from "./components/VerifiedSeal";
import { ILLUSTRATION, REWARD, usd } from "@/lib/rewards";
import type { SourceId } from "@/lib/sources";

// The display face, for values and titles inside otherwise-body sections.
const DISPLAY = "var(--font-display), ui-sans-serif, sans-serif";

const SOURCES: { id: SourceId; name: string; reads: string; note: string }[] = [
  { id: "youtube", name: "YouTube", reads: "The day your account was opened", note: "Google sign-in" },
  { id: "instagram", name: "Instagram", reads: "How much you post, and how many follow you", note: "Profile" },
  { id: "github", name: "GitHub", reads: "When you joined and what you have built", note: "Profile" },
  { id: "linkedin", name: "LinkedIn", reads: "Another independent account, and who knows you", note: "Profile" },
  { id: "spotify", name: "Spotify", reads: "A listening life", note: "Profile" },
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
    body: "No wallet, no download, no seed phrase. Start with the account you have had the longest, and your score appears straight away. Add more to raise it.",
  },
  {
    step: "02",
    title: "We read only what you approve",
    body: "Your accounts stay in your own store, not ours. You approve exactly what we read, we read it once, and you can revoke it whenever you want. We never see a password.",
  },
  {
    step: "03",
    title: "Save it, and it travels",
    body: "Sign in with Google to keep your score across every device and put it on the leaderboard. Other apps can check it without you doing any of this again.",
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
    <div className="relative flex min-h-dvh flex-1 flex-col">
      {/* The fixed, full-bleed atmosphere the whole page floats over. */}
      <HeroScene />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: "radial-gradient(58% 50% at 50% 34%, rgba(53,224,161,0.05), transparent 74%)",
        }}
      />
      <ScrollReveals />

      <div className="relative z-10 flex flex-1 flex-col">
        <Hero />

        {/* ------------------------------------------------------------ 01 claim */}
        <section className="px-6 py-[15vh]">
          <div className="mx-auto max-w-6xl">
            <p data-rise className="t-label flex items-center gap-2.5 text-accent"><span className="rings" aria-hidden="true" />
              01 / The one thing that cannot be bought
            </p>
            <h2 data-rise className="t-section mt-8 max-w-[22ch]">
              Followers can be bought. Posts can be bulk uploaded.{" "}
              <span className="text-accent">Time cannot.</span>
            </h2>
            <p data-rise className="mt-8 max-w-[58ch] text-lg leading-relaxed text-text-2">
              Somebody running a thousand fake accounts can buy every signal the internet normally
              uses to decide whether you are real. Followers, activity, a filled-in profile. All of
              it is for sale. What they cannot buy is a decade, so Patina scores the things that only
              exist because time passed, and treats everything else as nearly worthless until there
              is real history sitting underneath it.
            </p>
          </div>
        </section>

        {/* --------------------------------------------------------- 02 spec sheet */}
        <section className="px-6 py-[15vh]">
          <div className="mx-auto max-w-6xl">
            <p data-rise className="t-label flex items-center gap-2.5 text-accent"><span className="rings" aria-hidden="true" />02 / What counts</p>
            <h2 data-rise className="t-section mt-8 max-w-[20ch]">
              Weighted toward the things you cannot fake.
            </h2>
            <div
              data-rise
              className="mt-12 grid grid-cols-1 gap-px border border-line bg-line lg:grid-cols-5"
            >
              {SIGNALS.map((signal) => (
                <div key={signal.name} className="bg-bg p-7">
                  <div className="t-label text-text-4">{signal.name}</div>
                  <div className="mt-3">
                    <span className="text-4xl font-semibold text-text" style={{ fontFamily: DISPLAY }}>
                      {signal.weight}
                    </span>
                    <span className="text-lg text-accent"> /100</span>
                  </div>
                  <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${signal.weight}%` }}
                    />
                  </div>
                  <p className="mt-5 text-sm leading-relaxed text-text-3">{signal.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------- 03 cast list */}
        <section className="px-6 py-[15vh]">
          <div className="mx-auto max-w-6xl">
            <p data-rise className="t-label flex items-center gap-2.5 text-accent"><span className="rings" aria-hidden="true" />03 / What it reads today</p>
            <h2 data-rise className="t-section mt-8 max-w-[20ch]">
              Five accounts you already own.
            </h2>
            <div data-rise className="mt-12 border-t border-line">
              {SOURCES.map((source) => (
                <div
                  key={source.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-6 border-b border-line py-6"
                >
                  <div className="text-sm leading-relaxed text-text-2 sm:text-base">
                    {source.reads}
                  </div>
                  <div className="flex items-center gap-3">
                    <SourceGlyph id={source.id} />
                    <span
                      className="text-2xl font-semibold text-text sm:text-3xl"
                      style={{ fontFamily: DISPLAY }}
                    >
                      {source.name}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ 04 how */}
        <section id="how" className="px-6 py-[15vh]">
          <div className="mx-auto max-w-6xl">
            <p data-rise className="t-label flex items-center gap-2.5 text-accent"><span className="rings" aria-hidden="true" />04 / How it works</p>
            <div className="mt-12 grid gap-10 lg:grid-cols-3 lg:gap-14">
              {STEPS.map((step) => (
                <div key={step.step} data-rise className="border-t border-line-strong pt-6">
                  <span className="t-label text-accent">{step.step}</span>
                  <h3
                    className="mt-4 text-2xl font-semibold tracking-tight text-text"
                    style={{ fontFamily: DISPLAY }}
                  >
                    {step.title}
                  </h3>
                  <p className="mt-3 leading-relaxed text-text-2">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------------- 05 proof */}
        <section className="px-6 py-[15vh]">
          <div className="mx-auto max-w-6xl">
            <p data-rise className="t-label flex items-center gap-2.5 text-accent"><span className="rings" aria-hidden="true" />05 / Proof you can carry</p>
            <div className="mt-8 grid gap-12 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-16">
              <div>
                <div data-rise>
                  <VerifiedSeal size={104} />
                </div>
                <h2 data-rise className="t-section mt-8">
                  Not a quiz. A signed fact that travels.
                </h2>
                <p data-rise className="mt-8 max-w-[52ch] text-lg leading-relaxed text-text-2">
                  Every Patina score is cryptographically signed by our key on Vana. Anyone, a person
                  or another app, can check it is real without trusting us, and carry it anywhere that
                  wants proof of a real history. That is the whole reason to build on Vana instead of
                  behind a login.
                </p>
                <p data-rise className="mt-6 text-lg leading-relaxed text-text-2">
                  <Link href="/verify" className="text-accent underline underline-offset-4">
                    Verify any score
                  </Link>
                  , or{" "}
                  <Link href="/docs" className="text-accent underline underline-offset-4">
                    wire it into your own app
                  </Link>{" "}
                  in a single request.
                </p>
              </div>
              <div data-rise className="surface overflow-hidden rounded-xl">
                <div className="flex items-center gap-2.5 border-b border-line px-5 py-3">
                  <span className="rings" aria-hidden="true" />
                  <span className="t-label text-text-3">GET · api/verify</span>
                  <span className="t-label ml-auto flex items-center gap-1.5 text-accent">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                    Signed
                  </span>
                </div>
                <div className="scroll-x bg-ink px-5 py-5">
                  <pre className="t-mono text-xs leading-relaxed text-text-2 sm:text-sm">
                    <code>{`GET /api/verify/alice  ->  {
  "score": 83, "verdict": "Deeply worn in", "oldestYear": 2013,
  "attestation": { "app": "0x620d…54A1", "signature": "0x…" }
}`}</code>
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- 06 reward */}
        <section id="reward" className="px-6 py-[15vh]">
          <div className="mx-auto max-w-6xl">
            <p data-rise className="t-label flex items-center gap-2.5 text-accent"><span className="rings" aria-hidden="true" />06 / Why there is money in it</p>
            <h2 data-rise className="t-section mt-8 max-w-[24ch]">
              Half of anything Patina wins goes back to the people who made it happen.
            </h2>
            <p data-rise className="mt-8 max-w-[58ch] text-lg leading-relaxed text-text-2">
              Patina is competing in the Vana Cup, a public contest scored on a live leaderboard. If
              it places, half the winnings are split equally among the top {REWARD.places} people by
              points: your Patina score, plus 10 for every real person you bring. Paid in VANA by{" "}
              {REWARD.paidBy}.
            </p>
            <div
              data-rise
              className="mt-12 grid grid-cols-1 gap-px border border-line bg-line sm:grid-cols-3"
            >
              <div className="bg-accent-wash p-7">
                <div className="t-label text-accent">If Patina wins</div>
                <div className="mt-3 text-3xl font-semibold text-accent" style={{ fontFamily: DISPLAY }}>
                  about {usd(ILLUSTRATION.championPerShare)}
                </div>
                <div className="t-mono mt-2 text-sm text-text-3">
                  ~{Math.round(ILLUSTRATION.championPerShare)} VANA per share
                </div>
              </div>
              <div className="bg-bg p-7">
                <div className="t-label text-text-4">If Patina is 2nd to 5th</div>
                <div className="mt-3 text-3xl font-semibold text-text" style={{ fontFamily: DISPLAY }}>
                  about {usd(ILLUSTRATION.runnerUpPerShare)}
                </div>
                <div className="t-mono mt-2 text-sm text-text-3">
                  ~{Math.round(ILLUSTRATION.runnerUpPerShare)} VANA per share
                </div>
              </div>
              <div className="bg-bg p-7">
                <div className="t-label text-text-4">The full rules</div>
                <Link
                  href="/rewards"
                  className="tap mt-3 inline-block text-lg text-accent underline underline-offset-4"
                >
                  Read the terms
                </Link>
                <p className="mt-2 text-sm text-text-3">Including how it can go wrong</p>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- 07 limits */}
        <section className="px-6 py-[15vh]">
          <div className="mx-auto max-w-6xl">
            <p data-rise className="t-label flex items-center gap-2.5 text-accent"><span className="rings" aria-hidden="true" />07 / What Patina cannot do</p>
            <div className="mt-12 grid gap-10 lg:grid-cols-3 lg:gap-14">
              {LIMITS.map((item) => (
                <div key={item.title} data-rise className="border-t border-line-strong pt-6">
                  <h3
                    className="text-xl font-semibold tracking-tight text-text"
                    style={{ fontFamily: DISPLAY }}
                  >
                    {item.title}
                  </h3>
                  <p className="mt-3 leading-relaxed text-text-2">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------------- cta */}
        <section className="flex min-h-[80vh] flex-col items-center justify-center px-6 text-center">
          <h2 data-rise className="t-section mx-auto max-w-3xl">
            How far back does your <span className="text-accent">digital life</span> actually go?
          </h2>
          <div data-rise className="mt-12">
            <Link href="/connect" className="btn btn-fill px-10 py-4">
              <span>Find out</span>
            </Link>
          </div>
        </section>

        <footer className="border-t border-line px-6 py-12">
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
              <Link href="/docs" className="tap t-label text-text-3 transition hover:text-text">
                Docs
              </Link>
              <Link href="/privacy" className="tap t-label text-text-3 transition hover:text-text">
                Privacy
              </Link>
              <Link href="/terms" className="tap t-label text-text-3 transition hover:text-text">
                Terms
              </Link>
              <p className="t-label text-text-4">Built on Vana · Your data stays yours</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
