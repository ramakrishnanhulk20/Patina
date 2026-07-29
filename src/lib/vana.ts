import { createDirectDataController } from "@opendatalabs/vana-sdk/server";

const network = process.env.VANA_NETWORK === "mainnet" ? "mainnet" : "moksha";

/**
 * Patina reads one source per approval trip. Vana binds a grant to the
 * (user, app) pair rather than to a scope, so re-approving REPLACES the
 * previous scope set instead of adding to it. Each source therefore gets
 * its own controller and its own approval.
 */
/**
 * ONE scope per source, deliberately.
 *
 * A grant can cover several scopes, but `readApprovedData` reads exactly one:
 * whichever the access request reports back as `status.scope`. Asking for
 * `["instagram.profile", "instagram.posts"]` therefore paid for a grant over
 * both and returned only one of them, with no way to tell which until it
 * arrived.
 *
 * Where a source offers a choice, the scope carrying DATES wins. Timestamps
 * feed Age and Corroboration, which are 60 of the 100 points; follower counts
 * feed Standing, which is 10 and buyable anyway.
 */
export const SOURCES = {
  youtube: {
    id: "youtube",
    label: "YouTube",
    scopes: ["youtube.profile"],
    blurb: "The day your account was opened.",
  },
  instagram: {
    id: "instagram",
    label: "Instagram",
    // Web-collectable through the Data Pipe, and the scope that carries dates.
    // See the note in sources.ts.
    scopes: ["instagram.posts"],
    blurb: "How far back your posts go.",
  },
  github: {
    id: "github",
    label: "GitHub",
    scopes: ["github.profile"],
    blurb: "What you have built, and who with.",
  },
  linkedin: {
    id: "linkedin",
    label: "LinkedIn",
    scopes: ["linkedin.profile"],
    blurb: "Another independent account, and who is connected to you.",
  },
  spotify: {
    id: "spotify",
    label: "Spotify",
    scopes: ["spotify.profile"],
    blurb: "A listening life.",
  },
} as const;

export type SourceId = keyof typeof SOURCES;

export function isSourceId(value: string | null): value is SourceId {
  return value !== null && value in SOURCES;
}

/**
 * The scopes here and in sources.ts describe the same requests, so they must
 * not drift. sources.ts is client-safe and cannot import this file (it would
 * drag the SDK's server build into the browser bundle), hence the check rather
 * than a shared constant.
 */
if (process.env.NODE_ENV !== "production") {
  void import("./sources").then(({ SOURCE_SPECS }) => {
    for (const [id, spec] of Object.entries(SOURCES)) {
      const other = SOURCE_SPECS[id as keyof typeof SOURCE_SPECS];
      if (other && other.scopes.join() !== spec.scopes.join()) {
        console.warn(
          `[patina] scope mismatch for "${id}": vana.ts has ${spec.scopes.join()}, sources.ts has ${other.scopes.join()}`,
        );
      }
    }
  });
}

const controllers = new Map<SourceId, ReturnType<typeof createDirectDataController>>();

export function controllerFor(source: SourceId) {
  const existing = controllers.get(source);
  if (existing) return existing;

  const spec = SOURCES[source];
  const controller = createDirectDataController({
    env: "production",
    network,
    appPrivateKey: process.env.VANA_APP_PRIVATE_KEY!,
    app: {
      id: "patina",
      name: "Patina",
      homepageUrl: process.env.VANA_APP_URL!,
    },
    source: spec.id,
    scopes: [...spec.scopes],
  });

  controllers.set(source, controller);
  return controller;
}

export const appAddress = () => controllerFor("youtube").getAppAddress();
