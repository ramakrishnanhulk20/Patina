import Link from "next/link";
import Image from "next/image";
import { LandingNav } from "./components/landing/LandingNav";
import { LandingReveal } from "./components/landing/LandingReveal";
import { ScoreScrolly } from "./components/landing/ScoreScrolly";
import { RingField } from "./components/RingField";

/*
  The landing. Built on the app's own design system (tokens, type, buttons, ring
  motif, Lenis) and elevated with scroll-storytelling, after the raycash
  reference. The scroll-driven score section is a client component (ScoreScrolly);
  the nav and reveals are client too. Everything else is server-rendered.
*/

const SOURCES = ["YouTube", "GitHub", "Instagram", "LinkedIn", "Spotify"];

function Photo({
  src,
  alt,
  className = "",
  ratio = "aspect-[5/4]",
}: {
  src: string;
  alt: string;
  className?: string;
  ratio?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[18px] border border-line bg-gradient-to-br from-panel-2 to-panel shadow-[var(--shadow-lg)] ${ratio} ${className}`}
    >
      {/* Real photos live at /public/photos/01.jpg … 05.jpg. Until they land the
          frame shows a quiet gradient rather than a broken box. */}
      <Image src={src} alt={alt} fill sizes="(min-width: 920px) 34rem, 100vw" className="object-cover" />
    </div>
  );
}

/**
 * A desktop window, not a phone.
 *
 * These were phone mockups, from when Patina read public pages and the whole
 * flow fitted on a handset. Collection now runs through Vana Desktop, which
 * signs you in on your own machine, and a phone cannot do it at all. Showing a
 * handset here would promise the one thing the product no longer does.
 */
function Window({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[21rem] overflow-hidden rounded-xl bg-[#080c0a] shadow-[0_40px_70px_-30px_rgba(0,0,0,0.55)] ring-1 ring-inset ring-white/10">
      <div className="flex items-center gap-1.5 px-3.5 py-2.5">
        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-white/15" />
      </div>
      <div className="flex aspect-[4/3.4] flex-col overflow-hidden bg-panel">
        <div className="flex flex-col gap-0.5 border-b border-line px-4 pb-2.5 pt-3">
          <span className="text-[0.86rem] font-bold tracking-tight text-text">{title}</span>
          <span className="text-[0.6rem] text-text-4">{sub}</span>
        </div>
        <div className="flex flex-1 flex-col gap-1.5 overflow-hidden p-3">{children}</div>
      </div>
    </div>
  );
}

function Prow({
  ico,
  a,
  b,
  tag,
  tagQuiet = false,
}: {
  ico: string;
  a: string;
  b: string;
  tag?: string;
  tagQuiet?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded-[9px] bg-panel-2 p-2">
      <span className="grid h-6 w-6 flex-none place-items-center rounded-[7px] bg-accent-wash text-[0.62rem] font-extrabold text-accent">
        {ico}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[0.66rem] font-bold tracking-tight text-text">{a}</span>
        <span className="text-[0.55rem] leading-tight text-text-4">{b}</span>
      </span>
      {tag && (
        <span
          className={`t-mono flex-none rounded px-1.5 py-0.5 text-[0.5rem] ${
            tagQuiet ? "bg-accent-wash text-accent" : "bg-accent text-on-accent"
          }`}
        >
          {tag}
        </span>
      )}
    </div>
  );
}

const STORY = [
  {
    n: "01",
    h: "You already did the hard part.",
    p: "Years ago, without meaning to. The account you opened at fourteen is the credential. You just never had a way to use it as one.",
    src: "/photos/2.jpg",
    alt: "The weathered hands of an older person typing on a well-worn laptop at a wooden desk.",
  },
  {
    n: "02",
    h: "Nothing leaves your hands.",
    p: "Your data stays in your own Personal Server on Vana. We read it once, under a grant you approve and can revoke. We never see a password.",
    src: "/photos/3.jpg",
    alt: "A woman sitting by a window in soft daylight, calmly looking at her phone.",
    flip: true,
  },
  {
    n: "03",
    h: "It travels with you.",
    p: "Prove it once. Any other app can check the same score without you repeating a thing, because the proof is signed rather than locked behind our login.",
    src: "/photos/4.jpg",
    alt: "A man walking across a city street at golden hour, phone in hand, mid-stride.",
  },
  {
    n: "04",
    h: "A low score isn't an accusation.",
    p: "Young, private or quiet accounts score low and are doing nothing wrong. Patina reports how much history it can see. Absence of evidence is exactly that.",
    src: "/photos/5.jpg",
    alt: "A young person smiling while working on a laptop at a cafe table, coffee beside them.",
    flip: true,
  },
];

const COMPARE = {
  cols: ["Patina", "Biometric scan", "Document KYC", "Wallet age"],
  rows: [
    ["Proves years of real history", true, false, false, true],
    ["Works without biometrics", true, false, true, true],
    ["No ID document needed", true, true, false, true],
    ["Covers people without crypto", true, true, true, false],
    ["User can revoke access after", true, false, false, false],
    ["Proves you are one unique person", false, true, true, false],
  ] as [string, boolean, boolean, boolean, boolean][],
};

const LIMITS = [
  {
    h: "It cannot prove you are a person",
    p: "It reports how much real history it can see. A high score is strong evidence, not a certificate, and anyone telling you otherwise is selling something.",
  },
  {
    h: "A low score is not an accusation",
    p: "If you are nineteen, or private, or you simply do not post much, you will score low and you are doing nothing wrong.",
  },
  {
    h: "Aged accounts can be bought",
    p: "They do get sold, and that costs real money that climbs with age. It turns a free attack into an expensive one. It does not make it impossible.",
  },
];

const FAQ = [
  {
    q: "Why does this need a computer now?",
    a: "Because typing a username proves nothing. The old version read public pages, which meant anybody could enter anybody's handle. Now you sign in to each account through Vana Desktop, in a browser window on your own machine, and that is what proves the account is actually yours. It is a slower start and a far stronger claim at the end of it.",
  },
  {
    q: "Do you see my password?",
    a: "Never. The sign-in happens inside Vana Desktop on your computer and nothing about it reaches us. Patina holds no credentials and no tokens, and cannot sign in as you afterwards. What we read is the data your own Personal Server hands over under a grant you can revoke at any point.",
  },
  {
    q: "What happens to my data after you read it?",
    a: "We keep dates and counts, rounded to the month. Captions, post text, home addresses, email addresses, song and game titles, and the names of people you know are all dropped before anything is written down, not held and ignored. There is a test that fails if any of them ever reach storage.",
  },
  {
    q: "I'm 20. Am I going to look like a bot?",
    a: "You will score low, and that is by design rather than a judgement. The model carries a deliberate floor so a genuinely young person is never flattened to zero. A low score means “not much history here”, not “this is a fake”.",
  },
  {
    q: "Why should an app trust the number?",
    a: "It should not have to. Every score ships with an attestation signed by Patina's app key on Vana. Any developer can recover the signer themselves and confirm the score is genuinely ours and unaltered, without calling us at all.",
  },
  {
    q: "Do I need a crypto wallet, or an account with you?",
    a: "Neither. No wallet, no seed phrase, no payment, and there is nothing to sign up for. Your score follows you between computers on its own, because connecting proves which Vana account you are without us asking you for anything.",
  },
];

export default function Home() {

  return (
    <div className="relative flex min-h-dvh flex-1 flex-col">
      <LandingNav />

      {/* ── HERO ─────────────────────────────────────────────── */}
      <header className="relative overflow-hidden border-b border-line">
        <RingField className="opacity-70" />
        <div className="relative z-10 mx-auto flex max-w-[73rem] flex-col items-center gap-7 px-6 pb-16 pt-14 text-center sm:pt-20">
          <p className="t-eyebrow hero-rise text-accent-ink" style={{ animationDelay: "40ms" }}>
            You can&apos;t buy a decade
          </p>
          <h1 className="t-hero-xl hero-rise text-text" style={{ animationDelay: "120ms" }}>
            Proof you&apos;re
            <br />a real person.
          </h1>
          <p
            className="hero-rise max-w-[35rem] text-lg leading-relaxed text-text-2"
            style={{ animationDelay: "200ms" }}
          >
            Patina reads the history already sitting in accounts you own and turns it into portable
            evidence that a real human has been here for years. No documents. No face scan.
          </p>
          <div className="hero-rise flex flex-wrap justify-center gap-3" style={{ animationDelay: "280ms" }}>
            <Link href="/connect" className="btn btn-primary px-7 py-3.5 text-base">
              Get your score, free
            </Link>
            <a href="#how" className="btn btn-ghost px-7 py-3.5 text-base">
              See how it works
            </a>
          </div>
          <div className="hero-rise flex flex-wrap justify-center gap-2" style={{ animationDelay: "360ms" }}>
            {SOURCES.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel px-3.5 py-1.5 text-sm font-medium text-text-2"
              >
                <span className="h-[7px] w-[7px] rounded-full bg-accent opacity-70" />
                {s}
              </span>
            ))}
          </div>
          <p
            className="t-mono hero-rise mt-4 flex flex-wrap justify-center gap-x-3 gap-y-1 text-text-4"
            style={{ animationDelay: "440ms" }}
          >
            <span>[ No documents</span>
            <span>·</span>
            <span>No selfie</span>
            <span>·</span>
            <span>No wallet</span>
            <span>·</span>
            <span>60 seconds ]</span>
          </p>
        </div>
      </header>

      {/* ── PROOF BAR ────────────────────────────────────────── */}
      <section className="border-b border-line bg-panel">
        <div className="mx-auto grid max-w-[73rem] grid-cols-2 gap-px bg-line md:grid-cols-4">
          {[
            { v: "53%", k: "of internet traffic is now automated", accent: true },
            { v: "5", k: "accounts read, in about a minute" },
            { v: "0", k: "documents, selfies or wallets needed" },
            { v: "Free", k: "for individuals, permanently" },
          ].map((c) => (
            <div key={c.k} className="flex flex-col gap-1 bg-panel px-6 py-7">
              <span
                className={`text-[2.1rem] font-extrabold leading-none tracking-tight tabular-nums ${
                  c.accent ? "text-accent-ink" : "text-text"
                }`}
              >
                {c.v}
              </span>
              <span className="text-sm leading-snug text-text-4">{c.k}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── PROBLEM ──────────────────────────────────────────── */}
      <section className="px-6 py-24 sm:py-32">
        <div className="mx-auto grid max-w-[73rem] items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div data-reveal>
            <p className="t-eyebrow flex items-center gap-2 text-accent-ink">
              <span className="rings" aria-hidden="true" />
              The problem
            </p>
            <h2 className="t-section mt-5 text-text">The internet stopped being able to tell.</h2>
            <p className="mt-6 text-lg leading-relaxed text-text-2">
              Bots now make up more than half of all traffic. Followers are purchasable by the
              thousand. A convincing profile takes an afternoon to build and costs almost nothing.
            </p>
            <p className="mt-4 text-lg leading-relaxed text-text-2">
              Every signal the web leans on to spot a real person has become something you can simply
              buy, with one exception.
            </p>
            <p className="mt-6 text-[clamp(1.5rem,2.8vw,1.95rem)] font-semibold leading-tight tracking-tight text-text">
              Nobody has worked out how to buy a decade.
            </p>
          </div>
          <div data-reveal="right">
            <Photo
              src="/photos/1.jpg"
              alt="A busy pavement seen from above, commuters walking in the rain, several on their phones, faces indistinct."
              ratio="aspect-[4/5]"
            />
          </div>
        </div>
      </section>

      {/* ── THE SCORE (scroll-driven) ────────────────────────── */}
      <ScoreScrolly />

      {/* ── WHY IT HOLDS (dark band, alternating) ────────────── */}
      <section className="bg-band px-6 py-24 text-band-ink sm:py-28">
        <div className="mx-auto max-w-[73rem]">
          <div data-reveal>
            <p className="t-eyebrow flex items-center gap-2 text-on-band">
              <span className="rings" aria-hidden="true" />
              Why it holds up
            </p>
            <h2 className="t-section mt-5 max-w-[22ch]">Time is the one thing that isn&apos;t for sale.</h2>
          </div>

          <div className="mt-10 flex flex-col">
            {STORY.map((row) => (
              <div
                key={row.n}
                className="grid items-center gap-8 py-12 lg:grid-cols-2 lg:gap-16"
                data-reveal="left"
              >
                <div className={row.flip ? "lg:order-2" : ""}>
                  <span className="t-mono text-xs text-on-band">{row.n}</span>
                  <h3 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{row.h}</h3>
                  <p className="mt-4 text-lg leading-relaxed text-band-ink-2">{row.p}</p>
                </div>
                <div className={row.flip ? "lg:order-1" : ""}>
                  <Photo src={row.src} alt={row.alt} ratio="aspect-[5/4]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────── */}
      <section id="how" className="px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-[73rem]">
          <div className="mb-16 max-w-[46rem]" data-reveal>
            <p className="t-eyebrow flex items-center gap-2 text-accent-ink">
              <span className="rings" aria-hidden="true" />
              How it works
            </p>
            <h2 className="t-section mt-5 text-text">Three steps, on a computer.</h2>
            <p className="mt-6 max-w-[46ch] text-lg leading-relaxed text-text-2">
              It used to be a minute on a phone. It is longer now, and it has to be: proving an
              account is yours means signing in to it, and that happens on your machine rather than
              on ours.
            </p>
          </div>

          <div className="grid gap-12 lg:grid-cols-3 lg:gap-8">
            <div data-reveal>
              <Window title="Pick a source" sub="Start with your oldest">
                <Prow ico="GH" a="GitHub" b="Commits, and who replied" tag="Connect" />
                <Prow ico="LI" a="LinkedIn" b="When people connected" tag="Connect" tagQuiet />
                <Prow ico="SP" a="Spotify" b="A decade of dated saves" tag="Connect" tagQuiet />
                <Prow ico="ST" a="Steam" b="Usually your oldest account" tag="Connect" tagQuiet />
              </Window>
              <div className="mt-8">
                <span className="t-mono grid h-10 w-10 place-items-center rounded-full border border-line text-text-4">
                  01
                </span>
                <h3 className="mt-4 text-xl font-semibold tracking-tight text-text">
                  Pick your oldest account
                </h3>
                <p className="mt-3 leading-relaxed text-text-2">
                  No wallet and no seed phrase. Ten sources to choose from, and whichever you have
                  had longest is the one worth starting with.
                </p>
              </div>
            </div>

            <div data-reveal data-reveal-delay="80">
              <Window title="Sign in on your machine" sub="Through Vana Desktop">
                <Prow ico="↓" a="Vana Desktop" b="Opens a browser locally" />
                <Prow ico="✕" a="No password reaches us" b="The sign-in stays on your computer" />
                <Prow ico="✓" a="Dates only" b="Captions, addresses, names dropped" />
                <Prow ico="↺" a="Revocable" b="Take the grant back any time" />
                <div className="mt-auto rounded-full bg-accent px-4 py-2 text-center text-[0.65rem] font-bold text-on-accent">
                  Import
                </div>
              </Window>
              <div className="mt-8">
                <span className="t-mono grid h-10 w-10 place-items-center rounded-full border border-line text-text-4">
                  02
                </span>
                <h3 className="mt-4 text-xl font-semibold tracking-tight text-text">
                  Sign in on your own computer
                </h3>
                <p className="mt-3 leading-relaxed text-text-2">
                  Vana Desktop opens a browser window and asks you to log in. That is what turns a
                  typed username into a proven one, and it is why Patina never sees a password.
                </p>
              </div>
            </div>

            <div data-reveal data-reveal-delay="160">
              <Window title="Your Patina" sub="Signed and portable">
                <div className="flex flex-col items-center gap-0.5 py-2">
                  <span className="text-[2.6rem] font-extrabold leading-none tracking-tight tabular-nums text-accent">
                    71
                  </span>
                  <span className="text-[0.7rem] font-bold text-text">Well established</span>
                  <span className="text-[0.55rem] text-text-4">14.2 years · earliest 2012</span>
                </div>
                <Prow ico="↗" a="Your own page" b="patinadata.xyz/u/you" />
                <Prow ico="{}" a="Readable by any app" b="No login required" />
              </Window>
              <div className="mt-8">
                <span className="t-mono grid h-10 w-10 place-items-center rounded-full border border-line text-text-4">
                  03
                </span>
                <h3 className="mt-4 text-xl font-semibold tracking-tight text-text">
                  Keep it, and use it anywhere
                </h3>
                <p className="mt-3 leading-relaxed text-text-2">
                  Your page, your story, and a signed proof other apps can verify on their own,
                  without you doing any of this twice.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── COMPARISON (dark band) ───────────────────────────── */}
      <section className="bg-band px-6 py-24 text-band-ink sm:py-28">
        <div className="mx-auto max-w-[73rem]">
          <div className="mb-10 max-w-[46rem]" data-reveal>
            <p className="t-eyebrow flex items-center gap-2 text-on-band">
              <span className="rings" aria-hidden="true" />
              Honestly compared
            </p>
            <h2 className="t-section mt-5">A different question from everyone else.</h2>
            <p className="mt-6 text-lg leading-relaxed text-band-ink-2">
              Most verification asks whether you are a unique human. Patina asks how long you have
              been one. Those are different questions, and we do not win every row.
            </p>
          </div>

          <div className="scroll-x rounded-[18px] border border-band-line" data-reveal>
            <table className="w-full min-w-[42rem] border-collapse text-[0.95rem]">
              <thead>
                <tr className="border-b border-band-line">
                  <th className="p-4 text-left">&nbsp;</th>
                  {COMPARE.cols.map((c, i) => (
                    <th
                      key={c}
                      className={`t-mono p-4 text-left font-medium ${
                        i === 0 ? "text-on-band" : "text-band-ink-2"
                      }`}
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE.rows.map(([label, ...cells]) => (
                  <tr key={label as string} className="border-b border-band-line last:border-b-0">
                    <td className="p-4">{label}</td>
                    {cells.map((yes, i) => (
                      <td
                        key={i}
                        className={`p-4 text-center text-lg ${i === 0 ? "bg-[rgba(87,207,171,0.08)]" : ""}`}
                      >
                        {yes ? (
                          <span className="text-on-band">✓</span>
                        ) : (
                          <span className="text-band-ink-2 opacity-50">·</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="t-mono mt-5 text-band-ink-2">
            That last row is theirs, not ours. Patina is a signal, not a certificate.
          </p>
        </div>
      </section>

      {/* ── DEVELOPERS ───────────────────────────────────────── */}
      <section id="devs" className="px-6 py-24 sm:py-32">
        <div className="mx-auto grid max-w-[73rem] items-start gap-12 lg:grid-cols-2 lg:gap-16">
          <div data-reveal>
            <p className="t-eyebrow flex items-center gap-2 text-accent-ink">
              <span className="rings" aria-hidden="true" />
              For developers
            </p>
            <h2 className="t-section mt-5 text-text">Sybil resistance in one request.</h2>
            <p className="mt-6 text-lg leading-relaxed text-text-2">
              A fresh wallet is free. A decade of ordinary digital life is not. Read a signed,
              verifiable score for any public profile. No API key, no OAuth, CORS open.
            </p>
            <p className="mt-4 text-lg leading-relaxed text-text-2">
              Do not trust our JSON. Every response carries an attestation signed by Patina&apos;s app
              key on Vana. Recover the signer yourself and confirm it matches. You never have to trust
              this server.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/docs" className="btn btn-primary px-6 py-3 text-base">
                Read the docs
              </Link>
              <Link href="/verify" className="btn btn-ghost px-6 py-3 text-base">
                Try an example
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-4" data-reveal="right">
            <pre className="scroll-x rounded-[16px] border border-line-strong bg-code-bg px-6 py-5 text-[0.82rem] leading-relaxed text-code-text shadow-[var(--shadow-lg)]">
              <code>
                <span className="text-text-4"># One GET. No key.</span>
                {"\n"}GET https://patinadata.xyz/api/verify/alice
                {"\n\n"}
                {"{"}
                {"\n  "}
                <span className="text-on-band">&quot;score&quot;</span>: 76,
                {"\n  "}
                <span className="text-on-band">&quot;verdict&quot;</span>:{" "}
                <span className="text-[#e0b072]">&quot;Well established&quot;</span>,{"\n  "}
                <span className="text-on-band">&quot;oldestYear&quot;</span>: 2012,
                {"\n  "}
                <span className="text-on-band">&quot;yearsOfHistory&quot;</span>: 14.2,
                {"\n  "}
                <span className="text-on-band">&quot;attestation&quot;</span>: {"{"}
                {"\n    "}
                <span className="text-on-band">&quot;app&quot;</span>:{" "}
                <span className="text-[#e0b072]">&quot;0x620d…54a1&quot;</span>,{"\n    "}
                <span className="text-on-band">&quot;signature&quot;</span>:{" "}
                <span className="text-[#e0b072]">&quot;0x…&quot;</span>
                {"\n  "}
                {"}"}
                {"\n"}
                {"}"}
              </code>
            </pre>

            <div className="surface p-6">
              <span className="t-mono text-text-4">Embeddable badge</span>
              <svg
                width="223"
                height="30"
                viewBox="0 0 223 30"
                role="img"
                aria-label="Patina badge example"
                className="mt-3"
              >
                <rect x="0.5" y="0.5" width="222" height="29" rx="7" fill="#0d1b18" stroke="#2bb98a" strokeOpacity="0.35" />
                <g transform="translate(20 15)">
                  <circle r="7" fill="none" stroke="#2bb98a" strokeWidth="1.4" opacity="0.5" />
                  <circle r="3.1" fill="#2bb98a" />
                </g>
                <text x="34" y="15" dominantBaseline="central" fontFamily="ui-sans-serif, system-ui, sans-serif" fontSize="12.5" fontWeight="600">
                  <tspan fill="#eef2f0">Patina</tspan>
                  <tspan fill="#8c968f"> · </tspan>
                  <tspan fill="#2bb98a">83</tspan>
                  <tspan fill="#8c968f">/100 · </tspan>
                  <tspan fill="#eef2f0">13yr</tspan>
                </text>
                <g transform="translate(199 15)" stroke="#2bb98a" strokeWidth="1.9" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M-4 0 l2.6 2.6 L4.2 -3.2" />
                </g>
              </svg>
              <p className="mt-3 text-[0.98rem] leading-relaxed text-text-2">
                Drop it on a README, a personal site or a bio. Reads live and links back to the proof.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING ──────────────────────────────────────────── */}
      <section id="pricing" className="border-t border-line bg-panel px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-[73rem]">
          <div className="mb-14 max-w-[46rem]" data-reveal>
            <p className="t-eyebrow flex items-center gap-2 text-accent-ink">
              <span className="rings" aria-hidden="true" />
              Pricing
            </p>
            <h2 className="t-section mt-5 text-text">Free for people. Free to build on.</h2>
            <p className="mt-6 text-lg leading-relaxed text-text-2">
              Individuals never pay. Reading scores is free too, with limits set only high enough to
              stop a script. Patina costs real money to run, so that will not be true forever at
              volume, and when it changes we would rather hear what you need than guess at a number
              now.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {[
              {
                name: "Personal",
                price: "Free",
                blurb: "Your score, your page, your story. Free for good.",
                items: [
                  "All ten sources",
                  "A page anyone can check",
                  "No wallet, no card, no account",
                ],
                cta: { label: "Get your score", href: "/connect" },
                feature: false,
              },
              {
                name: "Developer",
                price: "Free",
                blurb: "Read any public score. Everything you need to build.",
                items: [
                  "No API key required",
                  "CORS open, call from the browser",
                  "Signed attestation on every response",
                  "MCP server and embeddable badge",
                ],
                cta: { label: "Read the docs", href: "/docs" },
                feature: true,
              },
              {
                name: "Volume",
                price: "Talk to us",
                blurb: "For apps gating real humans at scale.",
                items: [
                  "Higher limits",
                  "Uptime commitments",
                  "Integration help from whoever built it",
                ],
                // The same contact route the docs, privacy and terms pages use.
                // A dedicated Patina address would be better for a volume
                // conversation; there is not one yet, and inventing one on the
                // pricing section is how you lose the first enquiry.
                cta: { label: "Get in touch", href: "https://discord.gg/vanaofficial" },
                feature: false,
              },
            ].map((tier) => (
              <div
                key={tier.name}
                data-reveal
                className={`flex flex-col gap-4 rounded-[18px] border bg-panel p-8 ${
                  tier.feature
                    ? "border-accent shadow-[0_0_0_3px_var(--accent-wash),var(--shadow-lg)]"
                    : "border-line shadow-[var(--shadow)]"
                }`}
              >
                <span className={`t-mono ${tier.feature ? "text-accent-ink" : "text-text-4"}`}>
                  {tier.name}
                </span>
                <span className="text-[2rem] font-extrabold tracking-tight text-text">{tier.price}</span>
                <p className="text-[0.95rem] leading-relaxed text-text-2">{tier.blurb}</p>
                <ul className="flex flex-col gap-2 text-[0.93rem] text-text-2">
                  {tier.items.map((it) => (
                    <li key={it} className="flex gap-2.5">
                      <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-accent" aria-hidden="true" />
                      {it}
                    </li>
                  ))}
                </ul>
                <Link
                  href={tier.cta.href}
                  className={`btn mt-2 px-5 py-3 text-base ${tier.feature ? "btn-primary" : "btn-ghost"}`}
                >
                  {tier.cta.label}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── LIMITS ───────────────────────────────────────────── */}
      <section className="px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-[46rem]">
          <div className="mb-10" data-reveal>
            <p className="t-eyebrow flex items-center gap-2 text-accent-ink">
              <span className="rings" aria-hidden="true" />
              What Patina can&apos;t do
            </p>
            <h2 className="t-section mt-5 text-text">The limits, stated plainly.</h2>
            <p className="mt-6 text-lg leading-relaxed text-text-2">
              On the homepage rather than buried in a policy page, because a score you cannot
              interrogate is a score you should not trust.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            {LIMITS.map((l) => (
              <div key={l.h} data-reveal className="surface border-l-[3px] border-l-accent p-6">
                <h3 className="text-lg font-semibold tracking-tight text-text">{l.h}</h3>
                <p className="mt-2 leading-relaxed text-text-2">{l.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────── */}
      <section className="border-t border-line px-6 py-24 sm:py-28">
        <div className="mx-auto max-w-[46rem]">
          <div className="mb-8" data-reveal>
            <p className="t-eyebrow flex items-center gap-2 text-accent-ink">
              <span className="rings" aria-hidden="true" />
              Questions
            </p>
            <h2 className="t-section mt-5 text-text">The things people ask.</h2>
          </div>
          <div className="border-t border-line">
            {FAQ.map((f, i) => (
              <details key={f.q} className="group border-b border-line" open={i === 0}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-lg font-semibold tracking-tight text-text [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span
                    aria-hidden="true"
                    className="grid h-6 w-6 flex-none place-items-center text-accent transition-transform duration-200 group-open:rotate-45"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </span>
                </summary>
                <p className="pb-6 leading-relaxed text-text-2">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA (dark band) + reward hook ──────────────── */}
      <section id="get" className="bg-band px-6 py-28 text-center text-band-ink sm:py-32">
        <div className="mx-auto flex max-w-[73rem] flex-col items-center gap-7">
          <p className="t-eyebrow flex items-center gap-2 text-on-band" data-reveal>
            <span className="rings" aria-hidden="true" />
            Takes about a minute
          </p>
          <h2 className="t-section max-w-[19ch]" data-reveal>
            You already earned it. Go and collect it.
          </h2>
          <p className="max-w-[34rem] text-lg leading-relaxed text-band-ink-2" data-reveal>
            Connect the account you have had the longest and see what it is worth.
          </p>
          <div className="flex flex-wrap justify-center gap-3" data-reveal>
            <Link
              href="/connect"
              className="btn px-8 py-3.5 text-base"
              style={{ background: "var(--on-band)", color: "#06110d" }}
            >
              Get your score, free
            </Link>
            <Link
              href="/verify"
              className="btn px-8 py-3.5 text-base"
              style={{ color: "var(--band-ink)", border: "1px solid var(--band-line)" }}
            >
              Verify someone else&apos;s
            </Link>
          </div>

          {/* Won, so this states a result rather than selling a contest. */}
          <p className="mt-2 max-w-[42rem] text-[0.95rem] leading-relaxed text-band-ink-2" data-reveal>
            Patina won the Vana Cup 2026, first of 43 apps.
          </p>
          <p className="t-mono text-band-ink-2" data-reveal>
            [ No documents · No selfie · No wallet · Free for individuals ]
          </p>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer className="border-t border-line px-6 py-14">
        <div className="mx-auto grid max-w-[73rem] gap-10 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <span className="flex items-center gap-2 text-[1.05rem] font-semibold tracking-tight text-text">
              <span className="rings" aria-hidden="true" />
              Patina
            </span>
            <p className="mt-3 max-w-[17rem] text-sm leading-relaxed text-text-4">
              Portable proof of a real human history. Built on Vana.
            </p>
          </div>
          <FootCol
            title="Product"
            links={[
              ["Get your score", "/connect"],
              ["How it works", "/how-it-works"],
              ["Verify a score", "/verify"],
            ]}
          />
          <FootCol
            title="Developers"
            links={[
              ["Documentation", "/docs"],
              ["Verify API", "/verify"],
              ["Badge", "/docs"],
              ["GitHub", "https://github.com/ramakrishnanhulk20/Patina"],
            ]}
          />
          <FootCol
            title="Company"
            links={[
              ["Privacy", "/privacy"],
              ["Terms", "/terms"],
            ]}
          />
        </div>
        <p className="t-mono mx-auto mt-12 max-w-[73rem] text-text-4">© 2026 Patina · Built on Vana</p>
      </footer>

      <LandingReveal />
    </div>
  );
}

function FootCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h4 className="t-label mb-3 text-text-4">{title}</h4>
      {links.map(([label, href]) => {
        const external = href.startsWith("http");
        return external ? (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="block py-1 text-[0.93rem] text-text-2 transition-colors hover:text-accent-ink"
          >
            {label}
          </a>
        ) : (
          <Link
            key={label}
            href={href}
            className="block py-1 text-[0.93rem] text-text-2 transition-colors hover:text-accent-ink"
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
