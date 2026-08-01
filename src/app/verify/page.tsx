import Link from "next/link";
import { SectionLabel } from "../components/SectionLabel";
import { evidenceOf, profileByUsername } from "@/lib/store";
import { scorePatina, verdict } from "@/lib/score";
import { buildAttestation } from "@/lib/attest";

export const metadata = {
  title: "Verify",
  description: "Check that a Patina score is real, and see the signed proof behind it.",
};

export const dynamic = "force-dynamic";

const Check = (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const username = (typeof params.u === "string" ? params.u : "").trim();

  const profile = username ? await profileByUsername(username) : null;

  const result =
    profile && profile.username
      ? await (async () => {
          const score = scorePatina(evidenceOf(profile));
          const oldestYear = score.oldestSignal
            ? new Date(score.oldestSignal.date).getUTCFullYear()
            : null;
          const attestation = await buildAttestation({
            username: profile.username!,
            score: score.total,
            verdict: verdict(score),
            oldestYear,
            sources: score.sourcesConnected.length,
          });
          return { name: profile.username!, score, oldestYear, attestation };
        })()
      : null;

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10 sm:px-6 sm:py-14">
      <SectionLabel>Verify</SectionLabel>

      <h1 className="t-section mt-5 text-text">Check a Patina score is real.</h1>

      <p className="mt-5 text-lg leading-relaxed text-text-2">
        A screenshot can say anything. This reads the score live from Patina and shows the signed
        proof behind it, so another app — or another person — can trust it without taking anyone&apos;s
        word for it.
      </p>

      <form method="get" action="/verify" className="mt-8 flex flex-wrap gap-2">
        <input
          name="u"
          defaultValue={username}
          placeholder="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Username to verify"
          className="min-w-0 flex-1 rounded-lg border border-line-strong bg-bg px-3 py-3 text-text outline-none placeholder:text-text-4 focus:border-accent"
        />
        <button type="submit" className="btn btn-primary px-5 py-3 text-sm">
          Verify
        </button>
      </form>

      {username && !result && (
        <p className="mt-6 border border-warn/40 bg-warn/5 p-4 text-sm leading-relaxed text-warn">
          No Patina score found for &ldquo;{username}&rdquo;. Names are exact, so check the spelling.
        </p>
      )}

      {result && (
        <div className="mt-8 space-y-6">
          <div className="border border-accent/40 bg-accent-wash p-6">
            <span className="inline-flex items-center gap-1.5 text-accent">
              {Check}
              <span className="t-label">Verified live from Patina</span>
            </span>
            <p className="mt-3 text-5xl font-semibold text-text">
              {result.score.total}
              <span className="text-2xl text-text-3">/100</span>
            </p>
            <p className="mt-1 text-text-2">
              {verdict(result.score)} · {result.name} ·{" "}
              {result.oldestYear ? `traced back to ${result.oldestYear}` : "no dated source"}
            </p>
          </div>

          <div className="space-y-3">
            {result.score.components.map((component) => {
              const pct = component.max === 0 ? 0 : (component.points / component.max) * 100;
              return (
                <div key={component.key} className="border border-line bg-panel p-4">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="font-semibold text-text">{component.label}</span>
                    <span className="t-mono text-sm text-text-2">
                      {component.points}
                      <span className="text-text-4"> / {component.max}</span>
                    </span>
                  </div>
                  <div className="mt-2.5 h-[3px] w-full bg-line" aria-hidden="true">
                    <div
                      className="h-full bg-accent"
                      style={{ width: `${Math.max(pct, pct > 0 ? 1.5 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border border-line bg-panel p-5">
            <p className="t-label text-text-3">The signed proof</p>
            <p className="mt-2 text-sm leading-relaxed text-text-2">
              This score is signed by Patina&apos;s app key,{" "}
              <span className="t-mono break-all text-text-3">{result.attestation.app}</span> — the same
              address that pays for reads on Vana. Recover the signer of the message below and you get
              that address back. If it matches, the score is genuinely Patina&apos;s and has not been
              altered.
            </p>

            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-accent">
                Show the signed message and signature
              </summary>

              <p className="t-label mt-3 text-text-3">Message</p>
              <pre className="mt-1 overflow-x-auto rounded-lg border border-line bg-bg p-3 text-xs leading-relaxed text-text-3">
                {result.attestation.message}
              </pre>

              <p className="t-label mt-3 text-text-3">Signature</p>
              <pre className="mt-1 overflow-x-auto rounded-lg border border-line bg-bg p-3 text-xs text-text-3">
                {result.attestation.signature}
              </pre>

              <p className="mt-3 text-xs leading-relaxed text-text-4">
                Building an app? The same data as JSON, with CORS, is at{" "}
                <a
                  href={`/api/verify/${encodeURIComponent(result.name)}`}
                  className="text-accent underline underline-offset-4"
                >
                  /api/verify/{result.name}
                </a>
                . See the{" "}
                <Link href="/docs" className="text-accent underline underline-offset-4">
                  integration docs
                </Link>
                .
              </p>
            </details>
          </div>

          <Link
            href={`/u/${encodeURIComponent(result.name)}`}
            className="btn btn-ghost inline-block px-6 py-3 text-base"
          >
            See the full card
          </Link>
        </div>
      )}

      {!result && (
        <p className="mt-10 border-t border-line pt-6 text-sm leading-relaxed text-text-3">
          Every public score has a signed attestation from Patina&apos;s app address on Vana, so it can
          be checked without trusting this page. That portability is the point of building on Vana.
        </p>
      )}
    </main>
  );
}
