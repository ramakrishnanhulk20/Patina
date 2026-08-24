import { createDirectDataController } from "@opendatalabs/vana-sdk/server";
import { scopesFor, SOURCE_SPECS } from "./sources.ts";
import type { SourceId } from "./score.ts";

/**
 * Vana app identity and one controller per source.
 *
 * Match Vana's data-app-starter default: mainnet unless moksha is set
 * explicitly. The old inverted default (moksha unless mainnet) was a footgun,
 * because EIP-712 payment signs against the wrong chain if the env is missing.
 */
const network = process.env.VANA_NETWORK === "moksha" ? "moksha" : "mainnet";
const env = process.env.VANA_ENV === "dev" ? "dev" : "production";

/**
 * ALL of a source's scopes in ONE access request.
 *
 * v1 asked for exactly one scope per approval, with a long comment explaining
 * that `readApprovedData` reads only whichever scope the request reports back as
 * `status.scope`, so asking for two paid for a grant over both and returned one
 * of them at random.
 *
 * That is a limitation of the SDK HELPER, not of the protocol.
 * `createAccessRequest` takes `scopes: string[]`. Reads hit
 * `GET /v1/data/{scope}` authenticated by a `grantId`. Nothing binds a grant to
 * a single readable scope; `readApprovedData` simply hardcodes `status.scope`
 * and always did. Patina already bypasses that helper in vana-settle-read.ts,
 * so it can loop the same grant over every scope the grant covers.
 *
 * That takes GitHub from four approval trips to one, and the whole manifest
 * from twenty-one to ten.
 *
 * Sources still get their own controller and their own approval, because a
 * grant is bound to the (user, app, source) triple and approving a second
 * source REPLACES the first one's scopes rather than adding to them.
 */
export const SOURCES = SOURCE_SPECS;

export function isSourceId(value: string | null | undefined): value is SourceId {
  return typeof value === "string" && value in SOURCE_SPECS;
}

const controllers = new Map<SourceId, ReturnType<typeof createDirectDataController>>();

export function controllerFor(source: SourceId) {
  const existing = controllers.get(source);
  if (existing) return existing;

  const controller = createDirectDataController({
    env,
    network,
    appPrivateKey: process.env.VANA_APP_PRIVATE_KEY!,
    app: {
      id: "patina",
      name: "Patina",
      homepageUrl: process.env.VANA_APP_URL!,
    },
    source,
    scopes: scopesFor(source),
  });

  controllers.set(source, controller);
  return controller;
}

export const appAddress = () => controllerFor("github").getAppAddress();

export { network, env };
