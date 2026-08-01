import Link from "next/link";
import { SectionLabel } from "../components/SectionLabel";

export const metadata = {
  title: "Developer docs",
  description:
    "Integrate Patina: read a verifiable, signed proof of a real human history for any user, in one request.",
};

/** Patina's public app address on Vana — the key every attestation is signed by. */
const APP_ADDRESS = "0x620dDbEceaD28Bbf1b979bfaB8e3a7B893aa54A1";

const EXAMPLE_RESPONSE = `{
  "username": "alice",
  "score": 83,
  "verdict": "Deeply worn in",
  "oldestYear": 2013,
  "sourcesConnected": ["youtube", "github", "linkedin", "spotify"],
  "components": [
    { "key": "age", "label": "Age", "points": 38.4, "max": 40, "detail": "..." },
    { "key": "corroboration", "label": "Corroboration", "points": 17, "max": 20, "detail": "..." }
  ],
  "issuedAt": "2026-08-01T12:00:00.000Z",
  "attestation": {
    "app": "${APP_ADDRESS}",
    "message": "Patina score attestation\\n\\nusername: alice\\nscore: 83/100\\n...",
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

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-lg border border-line bg-ink p-4 text-xs leading-relaxed text-text-2">
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
        Patina turns the history in accounts a person already owns into a score out of 100 — high only
        when there are real years of history behind it. You can read that score, signed and verifiable,
        for anyone with a public Patina profile. No API key, no OAuth, one GET.
      </p>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-text">What it is good for</h2>
        <p className="mt-3 leading-relaxed text-text-2">
          Sybil resistance without KYC or biometrics: airdrops, quadratic funding, DAO votes, gated
          betas, one-human-one-vote. A fresh wallet is free; a decade of ordinary digital life is not,
          and the score is exactly how much of that history it can prove. Use it as a signal or a gate —
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
          public address. If it does, the score is genuinely ours and has not been altered — and you
          never had to trust this server.
        </p>

        <p className="t-label mt-6 text-text-3">Patina&apos;s app address</p>
        <Code>{APP_ADDRESS}</Code>

        <p className="t-label mt-6 text-text-3">viem</p>
        <Code>{VIEM_SNIPPET}</Code>

        <p className="t-label mt-6 text-text-3">ethers</p>
        <Code>{ETHERS_SNIPPET}</Code>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-text">Embed a verified badge</h2>
        <p className="mt-3 leading-relaxed text-text-2">
          A live SVG badge for any public profile — drop it on a site, a README, or a bio. It reads
          current and links back to the proof.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="t-label text-text-3">Looks like</span>
          <svg width="223" height="30" viewBox="0 0 223 30" role="img" aria-label="Example Patina badge">
            <rect x="0.5" y="0.5" width="222" height="29" rx="7" fill="#0b0c0b" stroke="#35e0a1" strokeOpacity="0.35" />
            <g transform="translate(20 15)">
              <circle r="7" fill="none" stroke="#35e0a1" strokeWidth="1.4" opacity="0.5" />
              <circle r="3.1" fill="#35e0a1" />
            </g>
            <text x="34" y="15" dominantBaseline="central" fontFamily="ui-sans-serif, system-ui, sans-serif" fontSize="12.5" fontWeight="600">
              <tspan fill="#f3f4f3">Patina</tspan>
              <tspan fill="#6c716c"> · </tspan>
              <tspan fill="#35e0a1">83</tspan>
              <tspan fill="#6c716c">/100 · </tspan>
              <tspan fill="#f3f4f3">13yr</tspan>
            </text>
            <g transform="translate(199 15)" stroke="#35e0a1" strokeWidth="1.9" fill="none" strokeLinecap="round" strokeLinejoin="round">
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
              0–100. Age and corroboration (whether independent sources agree on how far back you go)
              are 60 of it; depth, standing and breadth make up the rest and only count when real
              history backs them.{" "}
              <Link href="/" className="text-accent underline underline-offset-4">
                The full model is on the home page
              </Link>
              .
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-text">components</dt>
            <dd className="mt-1 leading-relaxed">
              The breakdown, each with its points, max, and a plain-English reason. Show it, or reduce
              it to a single number — it is your call.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-text">oldestYear</dt>
            <dd className="mt-1 leading-relaxed">
              The earliest year Patina can prove across every connected source, or null.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-text">issuedAt</dt>
            <dd className="mt-1 leading-relaxed">
              When this attestation was signed. Scores rise as people connect more, so an attestation is
              a snapshot — re-fetch for a fresh one.
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-text">Good to know</h2>
        <ul className="mt-4 space-y-3 leading-relaxed text-text-2">
          <li>Only people who have chosen a public username are verifiable — the same data as their public card.</li>
          <li>No key and no rate limit today, but be reasonable; the score changes slowly, so cache it.</li>
          <li>The signature is a plain EIP-191 message, so any Ethereum library verifies it, on-chain or off.</li>
        </ul>
      </section>

      <div className="mt-14 border-t border-line pt-8">
        <p className="leading-relaxed text-text-3">
          Try it live at{" "}
          <Link href="/verify" className="text-accent underline underline-offset-4">
            /verify
          </Link>
          , read the source on{" "}
          <a
            href="https://github.com/ramakrishnanhulk20/Patina"
            target="_blank"
            rel="noreferrer"
            className="text-accent underline underline-offset-4"
          >
            GitHub
          </a>
          , or ask in the{" "}
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
      </div>
    </main>
  );
}
