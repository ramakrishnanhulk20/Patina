import Link from "next/link";
import { SectionLabel } from "../components/SectionLabel";

export const metadata = {
  title: "Patina for AI agents",
  description:
    "An MCP server that lets Claude, ChatGPT and any other agent read how far back a person's history goes. No key, no OAuth.",
};

const SERVER_URL = "https://patinadata.xyz/api/mcp";

const TOOLS = [
  {
    name: "check_threshold",
    line: "Does this person clear a bar? Give a username plus a minimum score, a minimum number of years, or both. Answers true or false with a sentence you can quote.",
  },
  {
    name: "get_patina_score",
    line: "The full picture for one username: score, verdict, years of provable history, which platforms corroborate it, the component breakdown, and a signed attestation.",
  },
  {
    name: "verify_attestation",
    line: "Recovers the signer of a Patina attestation and hands back the address, so an agent can compare it rather than take our word for it.",
  },
  {
    name: "resolve_identity",
    line: "Goes from a GitHub, Instagram or LinkedIn handle to a score and a number of years. Never returns the person's Patina name or any other account they own.",
  },
];

const CLAUDE_STEPS = [
  "Open Settings, then Connectors.",
  "Choose Add custom connector.",
  "Paste the server URL above and save.",
  "Ask Claude something like: has alice been around more than five years, according to Patina?",
];

const CHATGPT_STEPS = [
  "Open Settings, then Apps, then Advanced, and turn on Developer Mode. It is off by default and needs a paid plan.",
  "Add a new connector and paste the server URL above.",
  "Start a chat and ask it to check a Patina score.",
];

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-lg border border-line bg-code-bg p-4 text-xs leading-relaxed text-code-text">
      <code>{children}</code>
    </pre>
  );
}

export default function McpPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-6 sm:py-14">
      <SectionLabel>For AI agents</SectionLabel>

      <h1 className="t-section mt-5 text-text">
        Everyone else checks you are one human, right now. Patina shows how far back you go.
      </h1>

      <p className="mt-6 text-lg leading-relaxed text-text-2">
        There are good services for proving that a caller is a single, distinct human at this
        moment. There is almost nothing an agent can call to ask the other question: how long has
        this person been here, and can any of it be checked. That is the only question Patina
        answers.
      </p>

      <p className="mt-4 leading-relaxed text-text-2">
        An aged account can be bought. What cannot be rushed is the time inside it, and time is
        priced by the year. Patina reads the history in accounts a person already owns and reports
        how much of it holds up, so an agent can treat a twelve-year record differently from a
        twelve-day one.
      </p>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-text">The server</h2>
        <p className="mt-3 leading-relaxed text-text-2">
          No API key. No OAuth. No account. Paste this into any MCP client and it works.
        </p>
        <Code>{SERVER_URL}</Code>
        <p className="mt-4 text-sm leading-relaxed text-text-3">
          Everything it serves is already public at{" "}
          <span className="t-mono">/api/verify/&#123;username&#125;</span>, and only profiles whose
          owner chose a public username are reachable at all.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-text">The tools</h2>
        <dl className="mt-4 space-y-5 text-text-2">
          {TOOLS.map((tool) => (
            <div key={tool.name}>
              <dt className="t-mono text-sm font-semibold text-text">{tool.name}</dt>
              <dd className="mt-1 leading-relaxed">{tool.line}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-6 text-sm leading-relaxed text-text-3">
          All four are read-only. Patina has no write path, and the server cannot change anything
          about anyone&apos;s profile.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-text">Add it to Claude</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 leading-relaxed text-text-2">
          {CLAUDE_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-text">Add it to ChatGPT</h2>
        <p className="mt-3 leading-relaxed text-text-2">
          Custom connectors sit behind Developer Mode, so there are a couple more steps.
        </p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 leading-relaxed text-text-2">
          {CHATGPT_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-text">What it does not tell you</h2>
        <ul className="mt-4 space-y-3 leading-relaxed text-text-2">
          <li>
            It is not a proof-of-personhood check. Patina reports how much history is visible and
            verifiable. It does not certify that somebody is human, unique, or present right now. If
            that is what you need, use a service built for it.
          </li>
          <li>
            A low score is not an accusation. Young accounts, private accounts and quiet accounts
            all score low, and none of them did anything wrong.
          </li>
          <li>
            No profile is not a red flag. Almost nobody has heard of Patina. An empty result means
            exactly that and nothing more, and the tools say so in the answer itself.
          </li>
          <li>
            <span className="t-mono text-text-3">resolve_identity</span> covers GitHub, Instagram
            and LinkedIn only. For other platforms Patina stores an internal id rather than a handle
            anyone could type. Those platforms still count fully toward the score.
          </li>
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-text">Do not trust this server</h2>
        <p className="mt-3 leading-relaxed text-text-2">
          Every score Patina hands out is signed. You can check that signature yourself, offline,
          without calling Patina at all, which means you never have to take our word for a number.
          That is the whole reason the signature exists.
        </p>
        <p className="mt-4 leading-relaxed text-text-2">
          There is a{" "}
          <Link href="/verify/offline" className="text-accent underline underline-offset-4">
            standalone checker
          </Link>{" "}
          that runs entirely in your browser, and the same check is four lines in{" "}
          <Link href="/docs" className="text-accent underline underline-offset-4">
            the docs
          </Link>
          .
        </p>
      </section>

      <div className="mt-14 border-t border-line pt-8">
        <p className="leading-relaxed text-text-3">
          Building on it? The plain HTTP API is documented at{" "}
          <Link href="/docs" className="text-accent-ink underline underline-offset-4">
            /docs
          </Link>
          , and questions are welcome in the{" "}
          <a
            href="https://discord.gg/vanaofficial"
            target="_blank"
            rel="noreferrer"
            className="text-accent-ink underline underline-offset-4"
          >
            Vana Discord
          </a>
          .
        </p>
      </div>
    </main>
  );
}
