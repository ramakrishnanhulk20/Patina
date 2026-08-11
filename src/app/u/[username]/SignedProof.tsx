"use client";

import Link from "next/link";
import { useState } from "react";
import { VerifiedSeal } from "../../components/VerifiedSeal";

/**
 * The on-chain proof, made tangible on the card itself.
 *
 * A shared card lands in front of a skeptic, and "trust me, it's signed" is not
 * proof, it is a claim. This puts the actual signed attestation on the page: the
 * app address that signed it (Patina's on-chain identity on Vana, the same key
 * that pays for reads), the exact EIP-191 message, and the signature, plus a
 * one-tap copy of the whole thing so it can be pasted into any wallet or library
 * and checked offline. Nothing here calls back to us to be believed.
 *
 * The signing happens on the server (the private key never reaches the browser);
 * this component only presents what was signed and lets a reader carry it away.
 */
export function SignedProof({
  username,
  app,
  message,
  signature,
  issuedAt,
  verifyUrl,
  apiPath,
}: {
  username: string;
  /** Patina's app address on Vana, recovered from the signature by a verifier. */
  app: string;
  message: string;
  signature: string;
  issuedAt: string;
  /** Absolute URL to the JSON attestation, included in the copied proof. */
  verifyUrl: string;
  /** Relative path to the machine-readable endpoint, for the "any app" link. */
  apiPath: string;
}) {
  const [copied, setCopied] = useState<"proof" | "address" | null>(null);

  async function copy(value: string, which: "proof" | "address") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      setTimeout(() => setCopied((c) => (c === which ? null : c)), 2000);
    } catch {
      // Blocked outside a secure context; the details block below is selectable.
    }
  }

  const proof = JSON.stringify({ app, message, signature, issuedAt, verify: verifyUrl }, null, 2);
  const shortApp = `${app.slice(0, 6)}…${app.slice(-4)}`;

  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-accent/30 bg-gradient-to-b from-accent-wash to-panel">
      <div className="flex items-start gap-4 p-5 sm:p-6">
        <VerifiedSeal size={56} className="shrink-0" />
        <div className="min-w-0">
          <p className="t-label text-text-3">Signed on Vana</p>
          <p className="mt-1 text-lg font-semibold tracking-tight text-text">
            Not a screenshot. A signature.
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-text-2">
            This score is signed by Patina&apos;s app key, the same on-chain address that pays for
            reads on Vana. Recover the signer from the message below and it comes back to that
            address, so anyone can check it without trusting this page.
          </p>
        </div>
      </div>

      <div className="grid gap-px bg-line sm:grid-cols-2">
        <button
          type="button"
          onClick={() => copy(app, "address")}
          className="tap group flex flex-col items-start gap-1 bg-panel p-4 text-left transition hover:bg-panel-2"
        >
          <span className="t-label text-text-3">Signer address</span>
          <span className="t-mono text-sm text-text group-hover:text-accent">{shortApp}</span>
          <span className="t-label text-text-4">{copied === "address" ? "Copied" : "Tap to copy"}</span>
        </button>
        <button
          type="button"
          onClick={() => copy(proof, "proof")}
          className="tap group flex flex-col items-start gap-1 bg-panel p-4 text-left transition hover:bg-panel-2"
        >
          <span className="t-label text-text-3">The full proof</span>
          <span className="text-sm font-medium text-text group-hover:text-accent">
            {copied === "proof" ? "Copied to clipboard" : "Copy message + signature"}
          </span>
          <span className="t-label text-text-4">Paste into any wallet or EIP-191 tool</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line/60 p-4 sm:px-6">
        <Link
          href={`/verify?u=${encodeURIComponent(username)}`}
          className="btn btn-primary px-5 py-2.5 text-sm"
        >
          Verify independently
        </Link>
        <a href={apiPath} className="tap t-label text-text-3 underline-offset-4 hover:text-accent hover:underline">
          Read it as JSON ({apiPath})
        </a>
      </div>
    </section>
  );
}
