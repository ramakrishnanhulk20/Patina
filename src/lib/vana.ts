import { createDirectDataController } from "@opendatalabs/vana-sdk/server";

const network = process.env.VANA_NETWORK === "mainnet" ? "mainnet" : "moksha";

/**
 * Patina reads one source per approval trip. Vana binds a grant to the
 * (user, app) pair rather than to a scope, so re-approving REPLACES the
 * previous scope set instead of adding to it. Each source therefore gets
 * its own controller and its own approval.
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
    scopes: ["instagram.profile", "instagram.posts"],
    blurb: "Years of posts, with their real dates.",
  },
  github: {
    id: "github",
    label: "GitHub",
    scopes: ["github.profile"],
    blurb: "What you have built, and who with.",
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
