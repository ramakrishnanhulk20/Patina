import Link from "next/link";
import { SectionLabel } from "../components/SectionLabel";
import { PATINA_APP_ADDRESS } from "@/lib/patina-address";

export const metadata = {
  title: "Developer docs",
  description:
    "Integrate Patina: read a verifiable, signed proof of a real human history for any user, in one request.",
};

/** Patina's public app address on Vana. The key every attestation is signed by. */
const APP_ADDRESS = PATINA_APP_ADDRESS;

const EXAMPLE_RESPONSE = `{
  "username": "alice",
  "score": 71,
  "verdict": "Well established",
  "oldestYear": 2012,
  "yearsOfHistory": 14.2,
  "sourcesConnected": ["github", "steam", "spotify"],
  "components": [
    { "key": "age", "label": "Age", "points": 30, "max": 30, "detail": "..." },
    { "key": "continuity", "label": "Continuity", "points": 19.6, "max": 25, "detail": "..." },
    { "key": "corroboration", "label": "Corroboration", "points": 15, "max": 15, "detail": "..." },
    { "key": "vouches", "label": "Vouches", "points": 0.7, "max": 12, "detail": "..." },
    { "key": "depth", "label": "Depth", "points": 7.2, "max": 10, "detail": "..." },
    { "key": "breadth", "label": "Breadth", "points": 3.6, "max": 8, "detail": "..." }
  ],
  "provisional": false,
  "provisionalReason": null,
  "issuedAt": "2026-08-24T12:00:00.000Z",
  "attestation": {
    "app": "${APP_ADDRESS}",
    "message": "Patina score attestation\\n\\nusername: alice\\nscore: 71/100\\n...",
    "signature": "0x…",
    "howToVerify": "Recover the EIP-191 signer of \`message\` from \`signature\`; it equals \`app\`."
  }
}`;

const VIEM_SNIPPET = `import { recoverMessageAddress } from "viem";

const res = await fetch("https://patinadata.xyz/api/verify/alice");
const { score, attestation } = await res.json();

const signer = await recoverMessageAddress({
  message: attestation.message,
  signature: attestation.signature,
});

// True only if Patina really signed this exact score.
const genuine = signer.toLowerCase() === attestation.app.toLowerCase();`;

const ETHERS_SNIPPET = `import { verifyMessage } from "ethers";

const signer = verifyMessage(attestation.message, attestation.signature);
const genuine = signer.toLowerCase() === attestation.app.toLowerCase();`;

/**
 * No published prices, deliberately.
 *
 * Patina costs real money to run: every source read settles a fee against the
 * app's escrow. But putting a per-verification number on this page before a
 * single buyer conversation is how you pick the wrong one and then have to
 * defend it. Free with honest limits, and a way to reach us, until somebody
 * tells us what volume actually looks like.
 */
const PRICING = [
  {
    name: "Personal",
    price: "Free",
    detail: "Your own score, page and story. No wallet, no card, free for good.",
  },
  {
    name: "Developer",
    price: "Free",
    detail:
      "Read any public score and every MCP tool. No key, CORS-open, rate limited only enough to stop a script.",
  },
  {
    name: "Volume",
    price: "Talk to us",
    detail:
      "Higher limits, uptime commitments and integration help. We would rather hear what you need than guess at a price.",
  },
];

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-lg border border-line bg-code-bg p-4 text-xs leading-relaxed text-code-text">
      <code>{children}</code>
    </pre>
  );
}

export default function DocsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-6 sm:py-14">
      <SectionLabel>Developer docs</SectionLabel>

      <h1 className="t-section mt-5 text-text">Proof of a real human, in one request.</h1>

      <p className="mt-6 text-lg leading-relaxed text-text-2">
        Patina turns the history in accounts a person already owns into a score out of 100, high only
        when there are real years of history behind it. You can read that score, signed and verifiable,
        for anyone with a public Patina profile. No API key, no OAuth, one GET.
      </p>

      <p className="mt-4 leading-relaxed text-text-2">
        Being scored rather than doing the checking?{" "}
        <Link href="/how-it-works" className="text-accent underline underline-offset-4">
          How it works
        </Link>{" "}
        is the page for you: what is read from each account, what survives, and what the number
        means.
      </p>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-text">What it is good for</h2>
        <p className="mt-3 leading-relaxed text-text-2">
          Sybil resistance without KYC or biometrics: airdrops, quadratic funding, DAO votes, gated
          betas, one-human-one-vote. A fresh wallet is free; a decade of ordinary digital life is not,
          and the score is exactly how much of that history it can prove. Use it as a signal or a gate, 
          say, only wallets whose owner scores above 40.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-text">The endpoint</h2>
        <p className="mt-3 leading-relaxed text-text-2">
          Public and CORS-open, so you can call it straight from a browser or a backend.
        </p>
        <Code>{`GET https://patinadata.xyz/api/verify/{username}`}</Code>
        <p className="mt-4 text-sm text-text-3">Returns 404 if nobody holds that name. Otherwise:</p>
        <Code>{EXAMPLE_RESPONSE}</Code>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-text">Verify the signature</h2>
        <p className="mt-3 leading-relaxed text-text-2">
          This is the part that matters: don&apos;t trust our JSON, check the signature. Every response
          carries an <span className="t-mono text-text-3">attestation</span> signed by Patina&apos;s
          app key. Recover the signer from the message and signature and confirm it equals Patina&apos;s
          public address. If it does, the score is genuinely ours and has not been altered, and you
          never had to trust this server.
        </p>

        <p className="t-label mt-6 text-text-3">Patina&apos;s app address</p>
        <Code>{APP_ADDRESS}</Code>

        <p className="t-label mt-6 text-text-3">viem</p>
        <Code>{VIEM_SNIPPET}</Code>

        <p className="t-label mt-6 text-text-3">ethers</p>
        <Code>{ETHERS_SNIPPET}</Code>

        <p className="mt-6 leading-relaxed text-text-2">
          Prefer to see it work before you write any code? The{" "}
          <Link href="/verify/offline" className="text-accent underline underline-offset-4">
            standalone checker
          </Link>{" "}
          runs the same recovery in your browser, with no call back to Patina.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-text">Embed a verified badge</h2>
        <p className="mt-3 leading-relaxed text-text-2">
          A live SVG badge for any public profile, drop it on a site, a README, or a bio. It reads
          current and links back to the proof.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="t-label text-text-3">Looks like</span>
          <svg width="223" height="30" viewBox="0 0 223 30" role="img" aria-label="Example Patina badge">
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
        </div>

        <p className="t-label mt-6 text-text-3">HTML</p>
        <Code>{`<a href="https://patinadata.xyz/verify?u=alice">
  <img src="https://patinadata.xyz/api/badge/alice" alt="Patina verified" height="30" />
</a>`}</Code>

        <p className="t-label mt-6 text-text-3">Markdown</p>
        <Code>{`[![Patina verified](https://patinadata.xyz/api/badge/alice)](https://patinadata.xyz/verify?u=alice)`}</Code>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-text">The fields</h2>
        <dl className="mt-4 space-y-4 text-text-2">
          <div>
            <dt className="font-semibold text-text">score</dt>
            <dd className="mt-1 leading-relaxed">
              0–100. Age (30), Continuity (25) and Corroboration (15) are the time signals and are
              earned outright. Vouches (12), Depth (10) and Breadth (8) are gated behind them,
              because volume and followers can be manufactured in an afternoon and elapsed years
              cannot.{" "}
              <Link href="/how-it-works" className="text-accent underline underline-offset-4">
                The full model, component by component
              </Link>
              .
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-text">components</dt>
            <dd className="mt-1 leading-relaxed">
              The breakdown, each with its points, max, and a plain-English reason. Show it, or reduce
              it to a single number, it is your call.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-text">provisional</dt>
            <dd className="mt-1 leading-relaxed">
              True when the profile is below the signing floor: fewer than three connected sources,
              or fewer than two carrying a date. The score is still computed honestly and{" "}
              <code className="t-mono text-[0.9em] text-text">attestation</code> is null. Read it as{" "}
              <em className="not-italic text-text">not enough evidence either way</em>, never as
              grounds for suspicion, and do not use a provisional score as a trust gate on its own.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-text">oldestYear</dt>
            <dd className="mt-1 leading-relaxed">
              The earliest year Patina can prove across every connected source, or null. Paired with{" "}
              <code className="t-mono text-[0.9em] text-text">yearsOfHistory</code>, the same span to
              one decimal, which is usually the number you actually want to threshold on.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-text">issuedAt</dt>
            <dd className="mt-1 leading-relaxed">
              When this attestation was signed. Scores rise as people connect more, so an attestation is
              a snapshot, re-fetch for a fresh one.
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-text">Good to know</h2>
        <ul className="mt-4 space-y-3 leading-relaxed text-text-2">
          <li>Only people who have chosen a public username are verifiable, the same data as their public card.</li>
          <li>No key and no rate limit today, but be reasonable; the score changes slowly, so cache it.</li>
          <li>The signature is a plain EIP-191 message, so any Ethereum library verifies it, on-chain or off.</li>
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-text">From an AI agent</h2>
        <p className="mt-3 leading-relaxed text-text-2">
          Patina runs an MCP server, so Claude, ChatGPT and anything else that speaks the protocol
          can read a score mid-conversation. Same data as the endpoint above, same lack of an API
          key, with tools for the two questions an agent actually asks: what is this person&apos;s
          score, and do they clear a bar.
        </p>
        <Code>{`https://patinadata.xyz/api/mcp`}</Code>
        <p className="mt-4 leading-relaxed text-text-2">
          Setup for each client, and what the tools do and deliberately do not return, is on{" "}
          <Link href="/mcp" className="text-accent underline underline-offset-4">
            the MCP page
          </Link>
          .
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-text">Pricing</h2>
        <p className="mt-3 leading-relaxed text-text-2">
          Patina is free for individuals and free to start building on. Businesses that verify humans
          at volume pay for it, and that is how Patina makes money. No card to try it.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {PRICING.map((tier) => (
            <div key={tier.name} className="surface p-5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-lg font-semibold text-text">{tier.name}</span>
                <span className="t-label text-accent-ink">{tier.price}</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-text-3">{tier.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-14 border-t border-line pt-8">
        <p className="leading-relaxed text-text-3">
          Try it live at{" "}
          <Link href="/verify" className="text-accent-ink underline underline-offset-4">
            /verify
          </Link>
          , or ask in the{" "}
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
