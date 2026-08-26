import Link from "next/link";
import { SectionLabel } from "../components/SectionLabel";

export const metadata = {
  title: "Privacy",
  description: "What Patina collects, why, and how to delete it. In plain English.",
};

const SECTIONS: { heading: string; body: React.ReactNode }[] = [
  {
    heading: "What we collect",
    body: (
      <ul className="mt-3 space-y-3">
        <li>
          <strong className="text-text">A scrambled fingerprint of your Vana Personal Server</strong>
          , so your score is the same on every computer you connect from. It is a one-way hash: we
          cannot turn it back into an address, and it is not your email or your name. There is no
          sign-in to Patina at all.
        </li>
        <li>
          <strong className="text-text">Dates and counts from each source you connect</strong>: the
          month things happened in, how many there were, and the handle that account is known by,
          plus the score worked out from them. Never your posts, your messages, your captions, your
          addresses, the names of people you know, or the contents of the account.{" "}
          <Link href="/how-it-works" className="text-accent underline underline-offset-4">
            The full list, source by source
          </Link>
          .
        </li>
        <li>
          <strong className="text-text">A small cookie</strong>, so you can come back and find your
          own result.
        </li>
      </ul>
    ),
  },
  {
    heading: "What we never collect",
    body: (
      <>
        Your passwords. Signing in happens inside Vana Desktop, in a browser window on your own
        computer, and nothing about it reaches us. Your email or your name. And the actual contents
        of your accounts: Patina reads the shape of your history, not what is in it. Where a source
        hands over something we did not ask for, an email address on a YouTube profile, the names of
        everyone who liked a post, the address a car picked you up from, it is dropped before
        anything is written down.
      </>
    ),
  },
  {
    heading: "Why we keep it",
    body: (
      <>
        To show you your score and keep it across your devices, and to count eligibility against
        the underlying account so the same person cannot quietly count twice. That is the whole
        list.
      </>
    ),
  },
  {
    heading: "Who can see it",
    body: (
      <>
        Patina does not publish a list of who is here. There is nowhere on this site that pairs a
        set of names with a set of scores. Your shareable card at{" "}
        <span className="t-mono text-text-3">/u/your-name</span> is public only if you choose a name
        and share it, and it shows your score and how far your history goes back, never the accounts
        underneath. We do not sell your data, and we do not hand it to advertisers.
      </>
    ),
  },
  {
    heading: "AI assistants, and the public API",
    body: (
      <>
        <p>
          Patina has a public API, and an MCP server that lets AI assistants such as Claude and
          ChatGPT look up a score in the middle of a conversation. Both are open on purpose: no key,
          no sign-in, so any app or agent can check a score without asking us for permission.
        </p>
        <p className="mt-3">
          They can only see what is already public: a profile that has claimed a username, its score,
          how far back its history goes, and the breakdown behind it. The same things on your public
          card. If you have never chosen a username, your profile is not reachable through any of
          it.
        </p>
        <p className="mt-3">
          One of those tools works in the other direction, from a GitHub, Instagram or LinkedIn
          handle to a score. It returns the score and the number of years, and nothing else. It never
          returns your Patina name, and it never reveals which other accounts you have connected,
          because that would let somebody start with one handle and uncover the rest of your
          accounts. Lookups by email address are refused outright.
        </p>
        <p className="mt-3">
          When an assistant makes one of these calls, it reaches us from that assistant&apos;s own
          servers rather than from your device, and the answer goes back into that conversation.
          What happens to it after that is up to whoever runs the assistant, not us.
        </p>
      </>
    ),
  },
  {
    heading: "Revoking access, and deleting your data",
    body: (
      <>
        Two separate things. Revoking Patina&apos;s access inside your{" "}
        <a
          href="https://app.vana.org/sources"
          target="_blank"
          rel="noreferrer"
          className="text-accent underline underline-offset-4"
        >
          Vana account
        </a>{" "}
        stops any future read, Vana enforces that, not us. To remove what Patina has already stored,
        use the button below. It deletes everything immediately, no email and no waiting.
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-6 sm:py-14">
      <SectionLabel>Privacy</SectionLabel>

      <h1 className="t-section mt-5 text-text">What we keep, and how to take it back.</h1>

      <p className="mt-6 text-lg leading-relaxed text-text-2">
        Patina&apos;s whole point is that your data stays yours, so the privacy policy had better be
        short and true. Here it is, in plain English. Last updated 14 August 2026.
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

      <div className="mt-8 border border-line bg-panel p-5">
        <p className="text-sm font-semibold text-text">See, download, or delete your data</p>
        <p className="mt-1 max-w-[54ch] text-sm leading-relaxed text-text-2">
          Everything above is checkable rather than a promise. Your data page lists every row
          Patina stores, hands you a copy of it, and lets you remove one source or all of them.
        </p>
        <Link
          href="/my-data"
          className="btn btn-primary mt-4 inline-block px-5 py-2.5 text-sm"
        >
          Open your data page
        </Link>
      </div>

      <div className="mt-12 border-t border-line pt-8 text-sm leading-relaxed text-text-3">
        <p>
          Questions? Ask in the{" "}
          <a
            href="https://discord.gg/vanaofficial"
            target="_blank"
            rel="noreferrer"
            className="text-accent underline underline-offset-4"
          >
            Vana Discord
          </a>
          . See also the{" "}
          <Link href="/terms" className="text-accent underline underline-offset-4">
            terms
          </Link>.
        </p>
      </div>
    </main>
  );
}
