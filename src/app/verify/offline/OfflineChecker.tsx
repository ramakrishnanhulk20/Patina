"use client";

import { useState } from "react";
import { recoverMessageAddress } from "viem";
import { PATINA_APP_ADDRESS, PATINA_APP_ADDRESS_LOWER } from "@/lib/patina-address";
import { expiryOf } from "@/lib/attest";

/**
 * Checks a Patina attestation without asking Patina anything.
 *
 * This is deliberately a client component doing the recovery in the browser.
 * The moment verification runs on Patina's server, the answer is only as good
 * as Patina's honesty, and the signature has bought the user nothing. Here the
 * page is served once and every check after that is local: turn off the
 * network and it still works.
 *
 * The address is compared against a value typed into the page rather than
 * fetched, for the same reason. A checker that asks the server "which address
 * should I expect" can be told whatever the server likes.
 */

/**
 * "Stale" is its own outcome, not a kind of failure.
 *
 * A signature that recovers to Patina but has passed its expiry is not a
 * forgery, and telling somebody it is would accuse an honest person of one.
 * The right answer is that the score was true when it was issued and a current
 * copy should be fetched, which is a different sentence from "not genuine".
 */
type Result =
  | { state: "match"; recovered: string; expiresAt: Date }
  | { state: "stale"; recovered: string; expiresAt: Date | null }
  | { state: "mismatch"; recovered: string }
  | { state: "error"; message: string };

export function OfflineChecker() {
  const [message, setMessage] = useState("");
  const [signature, setSignature] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [checking, setChecking] = useState(false);

  async function check() {
    setChecking(true);
    setResult(null);

    try {
      const recovered = await recoverMessageAddress({
        message,
        signature: signature.trim() as `0x${string}`,
      });

      if (recovered.toLowerCase() !== PATINA_APP_ADDRESS_LOWER) {
        setResult({ state: "mismatch", recovered });
        return;
      }

      // The expiry is read out of the pasted MESSAGE, which is the half the
      // signature covers. Anything alongside it could have been edited on the
      // way here without breaking anything.
      const expiresAt = expiryOf(message);
      setResult(
        expiresAt !== null && expiresAt.getTime() > Date.now()
          ? { state: "match", recovered, expiresAt }
          : { state: "stale", recovered, expiresAt },
      );
    } catch (error) {
      setResult({
        state: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setChecking(false);
    }
  }

  const ready = message.trim() !== "" && signature.trim() !== "";

  return (
    <div className="mt-8">
      <label className="t-label block text-text-3" htmlFor="attestation-message">
        Attestation message
      </label>
      <textarea
        id="attestation-message"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        rows={9}
        spellCheck={false}
        placeholder={"Patina score attestation\n\nusername: alice\nscore: 83/100\n..."}
        className="mt-2 w-full rounded-lg border border-line bg-code-bg p-3 font-mono text-xs leading-relaxed text-code-text outline-none focus:border-accent"
      />
      <p className="mt-2 text-xs leading-relaxed text-text-3">
        Paste it exactly as it appears, including the blank line and every line break. A single
        changed character is the whole point: it will not verify.
      </p>

      <label className="t-label mt-6 block text-text-3" htmlFor="attestation-signature">
        Signature
      </label>
      <textarea
        id="attestation-signature"
        value={signature}
        onChange={(event) => setSignature(event.target.value)}
        rows={3}
        spellCheck={false}
        placeholder="0x…"
        className="mt-2 w-full rounded-lg border border-line bg-code-bg p-3 font-mono text-xs leading-relaxed break-all text-code-text outline-none focus:border-accent"
      />

      <button
        type="button"
        onClick={check}
        disabled={!ready || checking}
        className="mt-6 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-contrast transition disabled:cursor-not-allowed disabled:opacity-40"
      >
        {checking ? "Checking…" : "Check the signature"}
      </button>

      {result !== null && (
        <div
          className="surface mt-6 p-5"
          role="status"
          aria-live="polite"
        >
          {result.state === "match" && (
            <>
              <p className="font-semibold text-accent-ink">Genuine.</p>
              <p className="mt-2 leading-relaxed text-text-2">
                This message really was signed by Patina, not a character of it has been altered
                since, and it is still current. You did not have to trust Patina to learn that, and
                neither does anyone you pass it on to.
              </p>
              <p className="mt-2 leading-relaxed text-text-3">
                Good until {result.expiresAt.toISOString().slice(0, 10)}.
              </p>
            </>
          )}

          {result.state === "stale" && (
            <>
              <p className="font-semibold text-warn">Genuine, but out of date.</p>
              <p className="mt-2 leading-relaxed text-text-2">
                Patina really did sign this and nothing in it has been altered. It has simply passed
                its expiry{result.expiresAt ? ` on ${result.expiresAt.toISOString().slice(0, 10)}` : ""},
                so it describes what was true then rather than now. That is not a reason to doubt
                the person: ask them for a current one, or look their score up directly.
              </p>
              {result.expiresAt === null && (
                <p className="mt-2 leading-relaxed text-text-3">
                  This one carries no expiry line at all, which means it was signed before Patina
                  started dating them.
                </p>
              )}
            </>
          )}

          {result.state === "mismatch" && (
            <>
              <p className="font-semibold text-text">Not signed by Patina.</p>
              <p className="mt-2 leading-relaxed text-text-2">
                The signature is valid, but it belongs to a different signer. Either this
                attestation came from somewhere else, or the message has been edited since it was
                signed.
              </p>
            </>
          )}

          {result.state === "error" && (
            <>
              <p className="font-semibold text-text">That did not parse.</p>
              <p className="mt-2 leading-relaxed text-text-2">
                Nothing can be concluded from it either way. The signature is usually the problem:
                it should be one long 0x string. ({result.message})
              </p>
            </>
          )}

          {result.state !== "error" && (
            <dl className="mt-4 space-y-2 border-t border-line pt-4 text-xs">
              <div>
                <dt className="t-label text-text-3">Recovered signer</dt>
                <dd className="t-mono mt-1 break-all text-text-2">{result.recovered}</dd>
              </div>
              <div>
                <dt className="t-label text-text-3">Patina&apos;s address</dt>
                <dd className="t-mono mt-1 break-all text-text-2">{PATINA_APP_ADDRESS}</dd>
              </div>
            </dl>
          )}
        </div>
      )}
    </div>
  );
}
