import Link from "next/link";
import { SectionLabel } from "../components/SectionLabel";

export const metadata = {
  title: "Terms",
  description: "The terms for using Patina, in plain English.",
};

const SECTIONS: { heading: string; body: React.ReactNode }[] = [
  {
    heading: "What Patina is",
    body: (
      <>
        Patina turns the history in accounts you already own into a score that suggests how long a
        real person has been around. It is built on Vana&apos;s data-portability protocol but is an{" "}
        <strong className="text-text">independent app</strong> — not operated, run, or endorsed by
        the Vana Foundation. Patina is an entrant in their Vana Cup, nothing more.
      </>
    ),
  },
  {
    heading: "Use it honestly",
    body: (
      <>
        Connect only accounts that are genuinely yours. No bots, scripts, fabricated or purchased
        accounts, duplicate or Sybil accounts, and no entering as several people. This is not just our
        rule — it is the Vana Cup&apos;s, and breaking it voids any reward and can get the entries
        disqualified. Detecting fake history is the entire product, so it would be strange to allow it
        here.
      </>
    ),
  },
  {
    heading: "The reward is our promise, not Vana&apos;s",
    body: (
      <>
        The offer to share winnings is made by Patina, not by the Vana Foundation. It is governed by
        the{" "}
        <Link href="/rewards" className="text-accent underline underline-offset-4">
          reward rules
        </Link>{" "}
        and depends entirely on Patina placing in the Vana Cup. It is paid in VANA, whose value moves,
        and <strong className="text-text">if Patina does not place, there is nothing to pay</strong>.
        Patina will never ask you for a private key, a seed phrase, or any payment.
      </>
    ),
  },
  {
    heading: "No guarantees",
    body: (
      <>
        The score is evidence about the history it can see — not a certificate that you are human, and
        not advice. Patina is provided as-is, may be wrong or unavailable, and may change or stop.
        Parts of it depend on Vana and on the platforms you connect, which we do not control.
      </>
    ),
  },
  {
    heading: "Your data",
    body: (
      <>
        How we handle what you connect, and how to delete it, is set out in the{" "}
        <Link href="/privacy" className="text-accent underline underline-offset-4">
          privacy policy
        </Link>
        . The short version: we keep only your score and the signals behind it, we never see a
        password, and you can delete everything yourself at any time.
      </>
    ),
  },
  {
    heading: "Changes",
    body: (
      <>
        We may update these terms as the app and the competition evolve. The date below moves when we
        do, and anything that materially changes the reward will be said out loud, not slipped in
        quietly.
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-6 sm:py-14">
      <SectionLabel>Terms</SectionLabel>

      <h1 className="t-section mt-5 text-text">The deal, in plain English.</h1>

      <p className="mt-6 text-lg leading-relaxed text-text-2">
        No dark patterns and no fine print you need a lawyer for. Last updated 1 August 2026.
      </p>

      <div className="mt-10 divide-y divide-line border-y border-line">
        {SECTIONS.map((section) => (
          <section key={section.heading} className="py-6">
            <h2 className="text-lg font-semibold tracking-tight text-text sm:text-xl">
              {section.heading}
            </h2>
            <div className="mt-2 leading-relaxed text-text-2">{section.body}</div>
          </section>
        ))}
      </div>

      <div className="mt-12 border-t border-line pt-8">
        <p className="text-sm leading-relaxed text-text-3">
          Questions, or think something here is unfair? Say so in the{" "}
          <a
            href="https://discord.gg/vanaofficial"
            target="_blank"
            rel="noreferrer"
            className="text-accent underline underline-offset-4"
          >
            Vana Discord
          </a>
          .
        </p>
        <Link href="/connect" className="btn btn-primary mt-8 inline-block px-6 py-3.5 text-base">
          Get your score
        </Link>
      </div>
    </main>
  );
}
