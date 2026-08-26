import { createMcpHandler } from "mcp-handler";
import { recoverMessageAddress } from "viem";
import { expiryOf } from "@/lib/attest";
import { z } from "zod";

import {
  RESOLVABLE_SOURCES,
  SCORE_MEANING,
  acceptedSigners,
  checkThreshold,
  lookupByUsername,
  resolveIdentity,
} from "@/lib/mcp-lookup";

/**
 * Patina over MCP.
 *
 * Lets an AI agent ask how much provable history a person has, in the middle of
 * a conversation, with no key and no OAuth. Keyless is the point: OAuth is the
 * single biggest thing that kills MCP adoption, and everything Patina serves
 * here is already public at /api/verify.
 *
 * What this is NOT: Vana does not speak MCP, and this is not a Vana endpoint.
 * Vana is where the underlying data came from. This server is Patina's, calling
 * Patina's own store.
 *
 * Where Patina sits against the alternatives: World ID, Human Passport,
 * HumanPing, AgentPassport and the rest all prove UNIQUENESS, that a caller is
 * one distinct human right now. None of them prove TENURE. A freshly verified
 * unique human can be produced today; a 2010 account with sixteen years of real
 * activity behind it cannot. Patina answers the second question only, and the
 * tool descriptions say so rather than implying it covers the first.
 */

/**
 * Version reported to clients. Tracked by hand and kept in step with the
 * `server.json` published to the MCP registry, which is what clients actually
 * compare against. Not the package version: the app and this server ship on
 * different clocks.
 */
const SERVER_VERSION = "1.0.0";

/** Shared by every tool, so no tool can quietly disagree about what it is. */
const READ_ONLY = {
  readOnlyHint: true,
  openWorldHint: false,
  destructiveHint: false,
  idempotentHint: true,
} as const;

/**
 * The tenure-versus-uniqueness caveat, attached to both scoring tools.
 *
 * Without it a model will reach for Patina as a proof-of-human check, which it
 * is not, and confidently tell a user something untrue.
 */
const WHAT_IT_DOES_NOT_PROVE =
  "Patina proves TENURE: that whoever holds these accounts has a long, " +
  "corroborated, verifiable history. It does NOT prove uniqueness or liveness, " +
  "and it is not a proof-of-personhood check. If you need 'exactly one human, " +
  "present right now', Patina is the wrong signal and you should say so.";

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "get_patina_score",
      {
        title: "Get Patina score",
        description:
          "Look up a person's full Patina score by their Patina username. Patina reads " +
          "the age and activity of accounts somebody already owns (YouTube, GitHub, " +
          "Instagram, LinkedIn, Spotify and others) through the Vana data portability " +
          "protocol, and turns that into a 0-100 score plus a signed attestation. " +
          SCORE_MEANING +
          " " +
          WHAT_IT_DOES_NOT_PROVE +
          " Call this when you want the whole picture: the score, the per-component " +
          "breakdown, how many years of history are provable, which platforms " +
          "corroborate each other, and an attestation you can verify offline. If you " +
          "only need a yes or no about whether somebody clears a bar, call " +
          "check_threshold instead. An unknown username comes back with found: false, " +
          "which is a normal answer meaning no public Patina profile exists under that " +
          "name. It is not an error, and it is not evidence against the person.",
        inputSchema: z.object({
          username: z
            .string()
            .describe("The person's Patina username, as it appears at patinadata.xyz/u/<username>."),
        }),
        annotations: READ_ONLY,
      },
      async ({ username }) => {
        const result = await lookupByUsername(username);

        if (!result.found) {
          const output = {
            found: false as const,
            username: result.username,
            message: result.reason,
          };
          return {
            content: [{ type: "text" as const, text: result.reason }],
            structuredContent: output,
          };
        }

        return {
          content: [{ type: "text" as const, text: renderScore(result) }],
          structuredContent: {
            found: true as const,
            username: result.username,
            score: result.score,
            verdict: result.verdict,
            yearsOfHistory: result.yearsOfHistory,
            oldestYear: result.oldestYear,
            oldestSource: result.oldestSource,
            sourcesConnected: result.sourcesConnected,
            components: result.components,
            profileUrl: result.profileUrl,
            docs: result.docs,
            attestation: result.attestation,
          },
        };
      },
    );

    server.registerTool(
      "check_threshold",
      {
        title: "Check a Patina trust bar",
        description:
          "Decide whether somebody clears a trust bar, as a plain true or false. Give a " +
          "Patina username plus min_score, min_years, or both. At least one is required. " +
          "Returns `pass`, plus a one-sentence `reason` written to be quoted straight " +
          "back to a user. This is the right tool for gating decisions: 'has this person " +
          "been verifiably around for at least five years', 'is this account above 70'. " +
          SCORE_MEANING +
          " " +
          WHAT_IT_DOES_NOT_PROVE +
          " When no profile exists, `pass` is false and `found` is false: treat that as " +
          "UNKNOWN rather than as a failed check, because most people have never heard " +
          "of Patina and absence proves nothing about them.",
        inputSchema: z.object({
          username: z.string().describe("The person's Patina username."),
          min_score: z
            .number()
            .min(0)
            .max(100)
            .optional()
            .describe("Lowest acceptable Patina score, 0-100. Passing requires score >= this."),
          min_years: z
            .number()
            .min(0)
            .optional()
            .describe(
              "Lowest acceptable years of provable history. Passing requires the oldest " +
                "provable signal to be at least this many years old.",
            ),
        }),
        annotations: READ_ONLY,
      },
      async ({ username, min_score, min_years }) => {
        const result = await checkThreshold({
          username,
          minScore: min_score,
          minYears: min_years,
        });

        return {
          content: [{ type: "text" as const, text: result.reason }],
          structuredContent: {
            pass: result.pass,
            reason: result.reason,
            found: result.found,
            score: result.score,
            yearsOfHistory: result.yearsOfHistory,
          },
        };
      },
    );

    server.registerTool(
      "verify_attestation",
      {
        title: "Verify a Patina attestation",
        description:
          "Check whether a Patina attestation really was signed by Patina. Every Patina " +
          "score ships with an EIP-191 signed message; hand this tool that `message` and " +
          "`signature` and it returns the address it recovered, the address Patina " +
          "publishes, and whether the two match. " +
          "IMPORTANT, AND THE WHOLE POINT: you do not need this tool, and where you can, " +
          "you should not use it. A signature is worth something precisely because " +
          "ANYONE can check it offline, with no call to Patina, using viem's " +
          "recoverMessageAddress or ethers' verifyMessage. If you ask Patina's own " +
          "server whether Patina's own signature is good, you are trusting Patina again " +
          "and the signature has bought you nothing. That is why this returns the " +
          "recovered address rather than a bare yes: compare it yourself. Attestations also " +
          "EXPIRE: the message carries an `expiresAt` line inside the signed bytes, and a " +
          "genuine signature past that date means the score was true when issued and should " +
          "be fetched again, not that anybody forged anything.",
        inputSchema: z.object({
          message: z
            .string()
            .describe("The exact `message` string from the attestation, newlines and all."),
          signature: z.string().describe("The `signature` from the attestation, 0x-prefixed."),
        }),
        annotations: READ_ONLY,
      },
      async ({ message, signature }) => {
        const { canonical, configured } = acceptedSigners();
        let recovered: string | null = null;
        let error: string | null = null;

        try {
          recovered = await recoverMessageAddress({
            message,
            signature: signature as `0x${string}`,
          });
        } catch (cause) {
          error = cause instanceof Error ? cause.message : String(cause);
        }

        const is = (address: string | null) =>
          recovered !== null && address !== null && recovered.toLowerCase() === address.toLowerCase();

        const matchesCanonical = is(canonical);
        // True only on a preview or local deployment holding its own test key.
        const matchesThisDeployment = is(configured);
        const signatureValid = matchesCanonical || matchesThisDeployment;

        /**
         * A genuine signature is not the same as a current claim.
         *
         * Attestations carry their expiry inside the signed message. An agent
         * gating access on one must be told the difference between "somebody
         * forged this" and "this was true last spring", because those call for
         * opposite responses: refuse the first, ask for a fresh copy for the
         * second. Reporting only `matches` would collapse them.
         */
        const expiresAt = expiryOf(message);
        const expired = expiresAt === null || expiresAt.getTime() <= Date.now();
        const matches = signatureValid && !expired;

        const staleNote = expiresAt
          ? ` The signature is genuine, but this attestation expired on ${expiresAt.toISOString().slice(0, 10)}. That is not a forgery: the score was true when it was issued. Fetch a current one with get_patina_score before relying on it.`
          : " The signature is genuine, but this attestation carries no expiry date, which means it predates Patina's expiry rule. Fetch a current one with get_patina_score before relying on it.";

        const text = error
          ? `Could not recover a signer from that signature: ${error}. ` +
            "The message or signature is malformed, so nothing can be concluded from it."
          : signatureValid && expired
            ? `Genuine but STALE.${staleNote}`
          : matchesCanonical
            ? `Genuine. The signature recovers to ${recovered}, which is Patina's published ` +
              "signing address. You can reproduce this check offline, without Patina."
            : matchesThisDeployment
              ? `Signed by this deployment (${recovered}), which is a non-production Patina ` +
                `instance. It is NOT the published Patina address (${canonical}), so do not ` +
                "treat it as a live Patina attestation."
              : `NOT genuine. The signature recovers to ${recovered}, but Patina publishes ` +
                `${canonical}. This attestation was not produced by Patina.`;

        return {
          content: [{ type: "text" as const, text }],
          structuredContent: {
            recovered,
            expected: canonical,
            /** Genuine AND current. The only field worth gating on. */
            matches,
            /** Genuine, whatever the date says. */
            signatureValid,
            /** Genuine but out of date. Ask for a fresh one; do not refuse the person. */
            expired,
            expiresAt: expiresAt?.toISOString() ?? null,
            matchedPublishedAddress: matchesCanonical,
            error,
            howToCheckYourself:
              "recoverMessageAddress({ message, signature }) from viem, or " +
              "verifyMessage(message, signature) from ethers, then compare to `expected`. " +
              "Then read the `expiresAt` line out of the message itself and check it is still " +
              "in the future. Both checks run offline, with no network call to Patina, which " +
              "is the entire point.",
          },
        };
      },
    );

    server.registerTool(
      "resolve_identity",
      {
        title: "Resolve a platform handle to a Patina score",
        description:
          "Find out whether the person behind a platform handle has a Patina score, " +
          "WITHOUT learning who they are. Supported sources: " +
          RESOLVABLE_SOURCES.join(", ") +
          ". Accepts a bare handle, an @handle, or a full profile URL. " +
          "Returns only three things: whether a public Patina profile is linked to that " +
          "account, its score, and its years of history. " +
          "It deliberately never returns the Patina username, and never returns which " +
          "other platforms that person has connected, because doing so would turn this " +
          "into a cross-platform de-anonymisation tool. Do not ask it for those; it " +
          "cannot provide them. " +
          "Other platforms (youtube, spotify, amazon, uber) are NOT supported " +
          "here, because for those Patina stores an internal platform id rather than a " +
          "handle a person could type. Those platforms still count fully toward the " +
          "score itself; only this lookup is limited. Email addresses are refused " +
          "outright. " +
          SCORE_MEANING,
        inputSchema: z.object({
          /**
           * Deliberately a string rather than an enum.
           *
           * An enum makes the SDK reject "youtube" during schema validation, and
           * the agent gets "expected one of github|instagram|linkedin" with no
           * reason. A model reading that can reasonably conclude Patina does not
           * support YouTube AT ALL, which is false and damaging: YouTube is the
           * single heaviest contributor to most scores. Taking the string lets
           * the handler answer properly, explaining that the lookup is limited
           * while the platform still counts fully toward the score.
           */
          source: z
            .string()
            .describe(
              `Which platform the handle belongs to. Supported for lookup: ${RESOLVABLE_SOURCES.join(", ")}. ` +
                "Anything else returns an explanation rather than a result.",
            ),
          handle: z
            .string()
            .describe(
              "The handle on that platform. 'torvalds', '@torvalds' and " +
                "'https://github.com/torvalds' are all accepted.",
            ),
        }),
        annotations: READ_ONLY,
      },
      async ({ source, handle }) => {
        const result = await resolveIdentity({ source, handle });

        const text = result.found
          ? `That ${source} account belongs to someone with a Patina score of ${result.score}` +
            (result.yearsOfHistory === null
              ? ", though no connected source carries a date, so no length of history is provable."
              : `, backed by ${result.yearsOfHistory} years of provable history.`) +
            " " +
            result.note
          : result.note;

        return {
          content: [{ type: "text" as const, text }],
          structuredContent: {
            found: result.found,
            supported: result.supported,
            score: result.score,
            yearsOfHistory: result.yearsOfHistory,
            note: result.note,
          },
        };
      },
    );
  },
  {
    serverInfo: { name: "patina", version: SERVER_VERSION },
    instructions:
      "Patina reports how much provable history a person has behind the accounts they " +
      "already own. Use check_threshold for yes/no trust gates, get_patina_score for the " +
      "full breakdown, and resolve_identity to go from a github, instagram or linkedin " +
      "handle to a score without learning who the person is. Patina proves tenure, not " +
      "uniqueness: it is not a proof-of-personhood check. A missing profile means the " +
      "person has not used Patina, and is never evidence against them.",
  },
);

/**
 * A readable rendering of a score.
 *
 * Models read the text block far more reliably than they read structured
 * content, so this is not decoration. It states the caveats inline, because a
 * model quoting a number without them is how a tenure score gets passed off to
 * a user as proof of a human.
 */
function renderScore(result: Extract<Awaited<ReturnType<typeof lookupByUsername>>, { found: true }>) {
  const lines: string[] = [];

  lines.push(`${result.username}: Patina score ${result.score}/100 (${result.verdict}).`);

  if (result.yearsOfHistory === null) {
    lines.push(
      "No connected source carries a date, so NO length of history is provable here. " +
        "The score comes from breadth and activity alone. Do not describe this person " +
        "as long-established.",
    );
  } else {
    lines.push(
      `${result.yearsOfHistory} years of provable history, oldest signal from ${result.oldestSource ?? "an undisclosed source"}` +
        (result.oldestYear === null ? "." : ` in ${result.oldestYear}.`),
    );
  }

  lines.push(
    result.sourcesConnected.length === 0
      ? "No platforms connected."
      : `Corroborated across ${result.sourcesConnected.length} independent ${
          result.sourcesConnected.length === 1 ? "platform" : "platforms"
        }: ${result.sourcesConnected.join(", ")}.`,
  );

  lines.push("");
  lines.push("Breakdown:");
  for (const component of result.components) {
    lines.push(`  ${component.label}: ${component.points}/${component.max}. ${component.detail}`);
  }

  lines.push("");
  lines.push(
    result.attestation
      ? "This score is signed. Verify it offline by recovering the EIP-191 signer of the " +
          `attestation message and checking it equals ${result.attestation.app}. No call to ` +
          "Patina required."
      : "This deployment is not configured to sign, so the score arrives unsigned.",
  );
  lines.push(`Profile: ${result.profileUrl}`);

  return lines.join("\n");
}

/**
 * CORS, so browser-based MCP clients and the MCP Inspector can reach this.
 *
 * Claude and ChatGPT connect server to server and never need it, but the
 * public verify route already serves open CORS on the same data and there is
 * nothing here that is not public.
 */
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, Mcp-Session-Id, Mcp-Protocol-Version",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, Mcp-Protocol-Version",
};

async function withCors(request: Request): Promise<Response> {
  const response = await handler(request);

  // Copy rather than mutate: some runtimes hand back immutable headers, and a
  // streamed body must be passed through untouched.
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS)) headers.set(key, value);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export const dynamic = "force-dynamic";

export { withCors as GET, withCors as POST, withCors as DELETE };

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
