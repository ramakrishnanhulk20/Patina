import { createPublicClient, erc20Abi, http, formatUnits } from "viem";
import {
  CONTRACTS,
  createEscrowGatewayClient,
  moksha,
  vanaMainnet,
  NATIVE_ASSET_ADDRESS,
} from "@opendatalabs/vana-sdk";
import { getDirectEndpoints } from "@opendatalabs/vana-sdk/server";
import { appAddress, env, network } from "./vana.ts";

/**
 * How much money is left, and how many more people it will serve.
 *
 * THE FAILURE THIS EXISTS TO CATCH. Every completed connection settles a real
 * fee from a prepaid escrow account. Nothing anywhere read that balance: not
 * the health check, not a script, not a job. So the product had a shutoff
 * switch nobody was watching. When the balance empties, the escrow gateway
 * refuses to authorise, every read comes back 402, and every person in the
 * middle of connecting sees a payment error. Patina is off, and the first
 * anyone hears about it is a complaint, if anyone bothers to complain.
 *
 * It is also the cheapest failure on the list to prevent, which is what makes
 * not having prevented it the expensive part.
 *
 * WHY THE NUMBER IS "CONNECTIONS", NOT A CURRENCY AMOUNT. A balance of
 * "8420000" means nothing to the person who has to decide whether to top it up
 * tonight. The only question worth answering is how many more people can
 * finish before it stops working, so that is what this reports, with the raw
 * amount alongside for anyone who wants to check the arithmetic.
 */

/**
 * What one connection costs, in whole units of the settlement asset.
 *
 * The gateway charges per scope read, and a source is up to four scopes, so a
 * single connection settles up to four of these. Estimating on the expensive
 * side is the right way round to be wrong: a warning that arrives early costs
 * nothing, and one that arrives late costs every signup until somebody notices.
 */
const FEE_PER_READ = 0.01;
const READS_PER_CONNECTION = 4;
const COST_PER_CONNECTION = FEE_PER_READ * READS_PER_CONNECTION;

/**
 * Below this many remaining connections, somebody needs to act.
 *
 * Set against how long a top-up takes rather than against how much money it is.
 * Two hundred connections is enough runway to notice, decide and deposit
 * without anybody being turned away in the meantime.
 */
export const LOW_BALANCE_CONNECTIONS = 200;

export type BalanceReading = {
  ok: boolean;
  /** The settlement asset's own symbol, e.g. "USDC.e". */
  symbol: string;
  /** Spendable right now, formatted for the asset's decimals. */
  available: number;
  /** Raw integer amount as the gateway reported it, for auditing. */
  availableRaw: string;
  /** Roughly how many more people can connect a source before this runs out. */
  connectionsLeft: number;
  /** True when the runway is short enough to need a person. */
  low: boolean;
  /** True when nothing more can be settled at all. The product is off. */
  empty: boolean;
  /** Why the reading failed, when it did. Never a bare false. */
  error?: string;
};

const chain = network === "mainnet" ? vanaMainnet : moksha;

/**
 * Asset metadata, read once per process.
 *
 * `decimals` cannot be guessed. Six is right for USDC and eighteen for most
 * other things, and picking the wrong one moves the reported balance by a
 * factor of a trillion, which would turn this from a safeguard into a way to
 * be confidently wrong about whether the product is about to stop.
 */
const assetCache = new Map<string, { symbol: string; decimals: number }>();

async function assetInfo(asset: string): Promise<{ symbol: string; decimals: number }> {
  const cached = assetCache.get(asset.toLowerCase());
  if (cached) return cached;

  if (asset.toLowerCase() === NATIVE_ASSET_ADDRESS.toLowerCase()) {
    const info = { symbol: chain.nativeCurrency?.symbol ?? "VANA", decimals: 18 };
    assetCache.set(asset.toLowerCase(), info);
    return info;
  }

  const client = createPublicClient({ chain, transport: http() });
  const [symbol, decimals] = await Promise.all([
    client.readContract({ address: asset as `0x${string}`, abi: erc20Abi, functionName: "symbol" }),
    client.readContract({ address: asset as `0x${string}`, abi: erc20Abi, functionName: "decimals" }),
  ]);

  const info = { symbol, decimals };
  assetCache.set(asset.toLowerCase(), info);
  return info;
}

/**
 * Read the app's spendable escrow balance.
 *
 * Uses `availableAmount` rather than `balance`, because that is the figure the
 * gateway actually authorises against: it is the balance minus everything
 * already soft-locked by payments in flight. Reporting `balance` would show
 * money that is spoken for and call the product healthy while reads were
 * already being refused.
 *
 * Never throws. A monitor that takes the site down when it cannot reach the
 * gateway is a worse problem than the one it was added to detect, so a failure
 * comes back as `ok: false` with the reason attached.
 */
export async function readEscrowBalance(): Promise<BalanceReading> {
  const unknown: BalanceReading = {
    ok: false,
    symbol: "",
    available: 0,
    availableRaw: "0",
    connectionsLeft: 0,
    low: false,
    empty: false,
  };

  let address: `0x${string}`;
  try {
    // The SDK types this as a plain string. It is an address and the gateway
    // needs it shaped as one, so the narrowing is checked rather than asserted:
    // a malformed key should be reported here, not fail deep inside the gateway.
    const raw = appAddress();
    if (!/^0x[0-9a-fA-F]{40}$/.test(raw)) {
      return { ...unknown, error: `app address is not an address: ${raw}` };
    }
    address = raw as `0x${string}`;
  } catch (error) {
    return { ...unknown, error: `no app identity: ${describe(error)}` };
  }

  try {
    const gateway = createEscrowGatewayClient(getDirectEndpoints(env).escrowGatewayUrl);
    const result = await gateway.getEscrowBalance(address);

    /**
     * The largest spendable entry, not the first.
     *
     * An account can hold several assets and the gateway returns them in no
     * promised order. Taking the first would report a dust balance in some
     * unrelated token and declare an emergency that is not happening.
     */
    const entries = result.balances ?? [];
    if (entries.length === 0) {
      return {
        ...unknown,
        ok: true,
        empty: true,
        low: true,
        error: "the escrow account holds no assets at all",
      };
    }

    const withInfo = await Promise.all(
      entries.map(async (entry) => {
        const { symbol, decimals } = await assetInfo(entry.asset);
        return {
          symbol,
          raw: entry.availableAmount,
          value: Number(formatUnits(BigInt(entry.availableAmount || "0"), decimals)),
        };
      }),
    );

    const best = withInfo.reduce((a, b) => (b.value > a.value ? b : a));
    const connectionsLeft = Math.floor(best.value / COST_PER_CONNECTION);

    return {
      ok: true,
      symbol: best.symbol,
      available: best.value,
      availableRaw: best.raw,
      connectionsLeft,
      low: connectionsLeft < LOW_BALANCE_CONNECTIONS,
      empty: connectionsLeft <= 0,
    };
  } catch (error) {
    return { ...unknown, error: describe(error) };
  }
}

/** The escrow contract this deployment settles against. Shown for topping up. */
export function escrowContractAddress(): string {
  const chainId = network === "mainnet" ? 1480 : 14800;
  return CONTRACTS.DataPortabilityEscrow.addresses[chainId as 1480 | 14800] as string;
}

/** One sentence an operator can act on without knowing any of the above. */
export function balanceAdvice(reading: BalanceReading): string {
  if (!reading.ok) return `Could not read the balance: ${reading.error ?? "unknown reason"}.`;
  if (reading.empty) {
    return "Out of funds. Connecting is failing for everybody right now. Top up the escrow account.";
  }
  if (reading.low) {
    return `About ${reading.connectionsLeft} more connections before connecting stops working. Top up soon.`;
  }
  return `About ${reading.connectionsLeft} more connections funded.`;
}

function describe(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}
