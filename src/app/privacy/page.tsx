import Link from "next/link";
import { SectionLabel } from "../components/SectionLabel";
import { DeleteData } from "../components/DeleteData";

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
          <strong className="text-text">A Google account id</strong>, when you sign in, a
          random-looking identifier Google gives us, so your score is the same on every device. Not
          your email, not your name.
        </li>
        <li>
          <strong className="text-text">A few signals from each source you connect</strong>: the date
          the account was opened, public counts like posts or followers, and the handle or channel id
          that account is known by, plus the score worked out from them. Not your posts, not your
          messages, not the contents of the account.
        </li>
        <li>
          <strong className="text-text">A payout wallet address</strong>, only if you choose to claim
          a reward, and only at that point.
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
        Your passwords, we never see them, because approval happens inside your own Vana account. Your
        email or name. And the actual contents of your accounts: Patina reads the shape of your
        history, not what is in it.
      </>
    ),
  },
  {
    heading: "Why we keep it",
    body: (
      <>
        To show you your score and keep it across your devices; to keep the reward honest, eligibility
        is counted against the underlying account, so the same person cannot quietly collect several
        shares; and, if Patina places in the Vana Cup, to pay you. That is the whole list.
      </>
    ),
  },
  {
    heading: "Who can see it",
    body: (
      <>
        The standings are deliberately anonymous, a rank and a score, no names or accounts. Your
        shareable card at <span className="t-mono text-text-3">/u/your-name</span> is public only if
        you choose a name and share it. We do not sell your data, and we do not hand it to advertisers.
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
        short and true. Here it is, in plain English. Last updated 1 August 2026.
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

      <div className="mt-8">
        <DeleteData />
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
          </Link>{" "}
          and the{" "}
          <Link href="/rewards" className="text-accent underline underline-offset-4">
            reward rules
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
