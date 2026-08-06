import Link from "next/link";
import { Hero } from "./components/Hero";
import { ScrollReveals } from "./components/ScrollReveals";
import { ClaimScene } from "./components/ClaimScene";
import { SectionLabel } from "./components/SectionLabel";
import { SourceGlyph } from "./components/SourceGlyph";
import { VerifiedSeal } from "./components/VerifiedSeal";
import type { SourceId } from "@/lib/sources";

const SOURCES: { id: SourceId; name: string; reads: string }[] = [
  { id: "youtube", name: "YouTube", reads: "The day your account was opened" },
  { id: "instagram", name: "Instagram", reads: "How much you post, and how many follow you" },
  { id: "github", name: "GitHub", reads: "When you joined and what you have built" },
  { id: "linkedin", name: "LinkedIn", reads: "Another independent account, and who knows you" },
  { id: "spotify", name: "Spotify", reads: "A listening life" },
];

const SIGNALS = [
  {
    name: "Age",
    weight: 40,
    body: "The oldest date we can prove across everything you connect. A YouTube account opened in 2013 is thirteen years you cannot manufacture.",
  },
  {
    name: "Corroboration",
    weight: 20,
    body: "Two unrelated platforms both saying you have been here since 2012. One old account can be bought. Two, on different services, is far harder to arrange.",
  },
  {
    name: "Depth",
    weight: 20,
    body: "The things you actually made. Posts, videos, repositories. Tedious to fake at volume, so it counts, but it counts less than time.",
  },
  {
    name: "Standing",
    weight: 10,
    body: "Other people and organisations treating you as real. Weighted lowest on purpose, because followers are the easiest thing here to buy.",
  },
  {
    name: "Breadth",
    weight: 10,
    body: "Independent accounts telling the same story. Faking one is easy. Faking four, each with its own decade behind it, is a different job.",
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
    body: "Sign in with Google to keep your score across every device. Other apps can check it without you doing any of this again.",
  },
];

const LIMITS = [
  {
    title: "It cannot prove you are a person",
    body: "It reports how much real history it can see. A high score means a long, human-looking trail. That is strong evidence, not a certificate, and anyone telling you otherwise is selling something.",
  },
  {
    title: "A low score is not an accusation",
    body: "If you are nineteen, or you keep your accounts private, or you simply do not post much, you will score low and you are not doing anything wrong. Absence of evidence is exactly that.",
  },
  {
    title: "Someone could buy an old account",
    body: "Aged accounts do get sold. That costs real money, and the price climbs with age, which is the point. It turns a free attack into an expensive one. It does not make it impossible.",
  },
];

const TIERS = [
  {
    name: "Personal",
    price: "Free",
    line: "Your score, your card, your story. Always free for individuals, with no wallet and no card.",
  },
  {
    name: "Developer",
    price: "Free to start",
    line: "Read any public score in one request. No key, generous limits, everything you need to build.",
  },
  {
    name: "Business",
    price: "Usage-based",
    line: "Higher volume, uptime commitments and support for apps gating real humans at scale.",
  },
];

export default function Home() {
  return (
    <div className="relative flex min-h-dvh flex-1 flex-col">
      <ScrollReveals />

      <div className="relative flex flex-1 flex-col">
        <Hero />

        {/* ------------------------------------------------- the core argument */}
        <section className="px-6 py-20 sm:py-28">
          <div className="mx-auto max-w-6xl">
            <ClaimScene />
          </div>
        </section>

        {/* ---------------------------------- the defensible asset, front-loaded */}
        <section className="border-t border-line bg-panel-2/40 px-6 py-20 sm:py-28">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-16">
              <div>
                <div data-rise>
                  <VerifiedSeal size={92} />
                </div>
                <div data-rise className="mt-8">
                  <SectionLabel>Proof you can carry</SectionLabel>
                </div>
                <h2 data-rise className="t-section mt-5 text-text">
                  Not a quiz result. A signed fact that travels.
                </h2>
                <p data-rise className="mt-6 max-w-[52ch] text-lg leading-relaxed text-text-2">
                  Every Patina score is cryptographically signed on Vana. Anyone, a person or another
                  app, can check it is real without trusting us, and carry it anywhere that wants
                  proof of a genuine history. That portability is the whole reason to build on Vana
                  instead of behind a login.
                </p>
                <p data-rise className="mt-6 text-lg leading-relaxed text-text-2">
                  <Link href="/verify" className="text-accent-ink underline underline-offset-4">
                    Verify any score
                  </Link>
                  , or{" "}
                  <Link href="/docs" className="text-accent-ink underline underline-offset-4">
                    wire it into your own app
                  </Link>{" "}
                  in a single request.
                </p>
              </div>

              <div data-rise className="surface overflow-hidden">
                <div className="flex items-center gap-2.5 border-b border-line px-5 py-3">
                  <span className="rings" aria-hidden="true" />
                  <span className="t-label text-text-3">GET · api/verify</span>
                  <span className="t-label ml-auto flex items-center gap-1.5 text-accent-ink">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                    Signed
                  </span>
                </div>
                <div className="scroll-x bg-code-bg px-5 py-5">
                  <pre className="t-mono text-xs leading-relaxed text-code-text sm:text-sm">
                    <code>{`GET /api/verify/alice  ->  {
  "score": 84, "verdict": "Deeply worn in", "oldestYear": 2013,
  "attestation": { "app": "0x620d...54A1", "signature": "0x..." }
}`}</code>
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* -------------------------------------------------- what it is built on */}
        <section className="border-t border-line px-6 py-20 sm:py-28">
          <div className="mx-auto max-w-6xl">
            <SectionLabel>What the score is built from</SectionLabel>
            <h2 data-rise className="t-section mt-5 max-w-[20ch] text-text">
              Weighted toward the things you cannot fake.
            </h2>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {SIGNALS.map((signal) => (
                <div key={signal.name} data-rise className="surface p-6">
                  <div className="flex items-baseline justify-between">
                    <span className="t-label text-text-3">{signal.name}</span>
                    <span className="text-2xl font-semibold tabular-nums text-accent-ink">
                      {signal.weight}
                      <span className="text-base text-text-4">/100</span>
                    </span>
                  </div>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-panel-2">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${signal.weight}%` }} />
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-text-3">{signal.body}</p>
                </div>
              ))}

              <div data-rise className="flex flex-col justify-center rounded-2xl border border-dashed border-line-strong p-6">
                <p className="text-sm leading-relaxed text-text-3">
                  Reads five accounts you already own today.
                </p>
                <ul className="mt-4 space-y-2.5">
                  {SOURCES.map((source) => (
                    <li key={source.id} className="flex items-center gap-2.5">
                      <SourceGlyph id={source.id} />
                      <span className="text-sm font-medium text-text-2">{source.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------- how it works */}
        <section id="how" className="border-t border-line px-6 py-20 sm:py-28">
          <div className="mx-auto max-w-6xl">
            <SectionLabel>How it works</SectionLabel>
            <h2 data-rise className="t-section mt-5 max-w-[18ch] text-text">
              A minute on your phone. No documents.
            </h2>
            <div className="mt-12 grid gap-10 lg:grid-cols-3 lg:gap-14">
              {STEPS.map((step) => (
                <div key={step.step} data-rise className="border-t border-line-strong pt-6">
                  <span className="t-label text-accent-ink">{step.step}</span>
                  <h3 className="mt-4 text-xl font-semibold tracking-tight text-text">{step.title}</h3>
                  <p className="mt-3 leading-relaxed text-text-2">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------- for developers */}
        <section className="border-t border-line bg-panel-2/40 px-6 py-20 sm:py-28">
          <div className="mx-auto max-w-6xl">
            <SectionLabel>For developers and business</SectionLabel>
            <h2 data-rise className="t-section mt-5 max-w-[24ch] text-text">
              Sybil resistance without KYC, in one request.
            </h2>
            <p data-rise className="mt-6 max-w-[62ch] text-lg leading-relaxed text-text-2">
              A fresh wallet is free; a decade of ordinary digital life is not. Gate airdrops,
              votes, funding rounds and betas on a real human history instead of a captcha. Patina
              is free for people. Businesses that verify humans at scale pay for it, and that is the
              revenue model.
            </p>

            <div className="mt-12 grid gap-4 sm:grid-cols-3">
              {TIERS.map((tier) => (
                <div key={tier.name} data-rise className="surface p-6">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-lg font-semibold text-text">{tier.name}</span>
                    <span className="t-label text-accent-ink">{tier.price}</span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-text-3">{tier.line}</p>
                </div>
              ))}
            </div>

            <div data-rise className="mt-8">
              <Link href="/docs" className="btn btn-ghost px-6 py-3.5 text-base">
                Read the developer docs
              </Link>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------- what it cannot */}
        <section className="border-t border-line px-6 py-20 sm:py-28">
          <div className="mx-auto max-w-6xl">
            <SectionLabel>Where it is honest with you</SectionLabel>
            <h2 data-rise className="t-section mt-5 max-w-[20ch] text-text">
              What Patina does not claim.
            </h2>
            <div className="mt-12 grid gap-10 lg:grid-cols-3 lg:gap-14">
              {LIMITS.map((item) => (
                <div key={item.title} data-rise className="border-t border-line-strong pt-6">
                  <h3 className="text-lg font-semibold tracking-tight text-text">{item.title}</h3>
                  <p className="mt-3 leading-relaxed text-text-2">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ close */}
        <section className="border-t border-line px-6 py-24 text-center sm:py-32">
          <h2 data-rise className="t-section mx-auto max-w-3xl text-text">
            How far back does your <span className="text-accent-ink">digital life</span> actually go?
          </h2>
          <div data-rise className="mt-10">
            <Link href="/connect" className="btn btn-primary px-9 py-4 text-base">
              Get your score, free
            </Link>
          </div>
          <p data-rise className="mx-auto mt-6 max-w-md text-sm leading-relaxed text-text-3">
            Patina is competing in the Vana Cup. If it places, half the winnings go back to early
            users.{" "}
            <Link href="/rewards" className="text-accent-ink underline underline-offset-4">
              See the terms
            </Link>
            .
          </p>
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
