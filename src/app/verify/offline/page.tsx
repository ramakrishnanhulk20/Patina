import Link from "next/link";
import { SectionLabel } from "../../components/SectionLabel";
import { PATINA_APP_ADDRESS_LOWER } from "@/lib/patina-address";
import { OfflineChecker } from "./OfflineChecker";

export const metadata = {
  title: "Check an attestation offline",
  description:
    "Verify a Patina attestation in your own browser, with no call to Patina. The check that makes the signature worth something.",
};

// Built from the shared constant rather than retyped, so the snippet on the
// page can never disagree with the address the checker actually compares to.
const SNIPPET = `import { recoverMessageAddress } from "viem";

const signer = await recoverMessageAddress({ message, signature });

// Patina's published signing address.
const genuine =
  signer.toLowerCase() === "${PATINA_APP_ADDRESS_LOWER}";`;

export default function OfflineVerifyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-6 sm:py-14">
      <SectionLabel>Verify offline</SectionLabel>

      <h1 className="t-section mt-5 text-text">Check it yourself. Do not trust us.</h1>

      <p className="mt-6 text-lg leading-relaxed text-text-2">
        Every Patina score comes with a signed message. This page checks one, entirely inside your
        browser, with no request to Patina and no request to anyone else. Load the page, turn off
        your network, and it still works.
      </p>

      <p className="mt-4 leading-relaxed text-text-2">
        That matters more than it sounds. If the only way to check a Patina score were to ask
        Patina, the signature would prove nothing: you would be trusting the same server twice. A
        signature is worth something precisely because a stranger can check it without us.
      </p>

      <OfflineChecker />

      <section className="mt-14">
        <h2 className="text-2xl font-semibold tracking-tight text-text">The same check, in code</h2>
        <p className="mt-3 leading-relaxed text-text-2">
          Nothing on this page is special. It is one function call from a standard Ethereum library,
          and any of them will do it. Run this anywhere, against any Patina attestation.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg border border-line bg-code-bg p-4 text-xs leading-relaxed text-code-text">
          <code>{SNIPPET}</code>
        </pre>
        <p className="mt-4 text-sm leading-relaxed text-text-3">
          Grab an attestation to test with from{" "}
          <span className="t-mono">/api/verify/&#123;username&#125;</span>, or read the full{" "}
          <Link href="/docs" className="text-accent underline underline-offset-4">
            developer docs
          </Link>
          .
        </p>
      </section>

      <div className="mt-14 border-t border-line pt-8">
        <p className="leading-relaxed text-text-3">
          Looking up a score instead?{" "}
          <Link href="/verify" className="text-accent-ink underline underline-offset-4">
            Verify by username
          </Link>
          . Wiring this into an AI agent?{" "}
          <Link href="/mcp" className="text-accent-ink underline underline-offset-4">
            Patina speaks MCP
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
