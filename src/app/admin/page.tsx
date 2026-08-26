import { notFound } from "next/navigation";
import { adminConfigured, isAdmin } from "@/lib/admin";
import { stats } from "@/lib/store";
import { dailyRate, funnel } from "@/lib/metrics";
import { balanceAdvice, escrowContractAddress, readEscrowBalance } from "@/lib/escrow-balance";
import { isPersistent, storeSelfTest } from "@/lib/store";
import { altchaConfigured } from "@/lib/altcha";
import { signerCheck, usingSharedKey } from "@/lib/attest";
import { SignIn } from "./SignIn";
import { Dashboard } from "./Dashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin", robots: { index: false, follow: false } };

/**
 * The inside of Patina, on one page.
 *
 * There was no way to see any of this. The admin surface was retired during the
 * v2 rebuild and never replaced, so nobody could answer how many people had
 * used the product, whether anything was broken, or how much money was left,
 * which meant every decision about what to build next was a guess dressed as a
 * judgement. Worse, the calculation was already written and tested: `stats()`
 * had sat in the store with no callers for weeks, computing the numbers and
 * throwing them away.
 *
 * ONE PAGE, ON PURPOSE. Everything an operator needs to decide whether to act
 * today, in the order they would ask: is it working, will it keep working, is
 * anybody using it, and where are they falling out. No navigation, no tabs, no
 * drill-downs. A dashboard nobody opens is worth nothing, and the surest way to
 * make one nobody opens is to make it a place rather than a page.
 */
export default async function AdminPage() {
  // Not configured means not present. A 404 rather than a login form, so the
  // path gives nothing away on a deployment that never set the password.
  if (!adminConfigured()) notFound();

  if (!(await isAdmin())) return <SignIn />;

  const burnPerDay = await dailyRate("connect_finished");

  const [counts, report, balance, store] = await Promise.all([
    stats({ fresh: true }),
    funnel(14),
    readEscrowBalance({ burnPerDay }),
    storeSelfTest(),
  ]);

  return (
    <Dashboard
      stats={counts}
      funnel={report}
      balance={{
        ok: balance.ok,
        symbol: balance.symbol,
        available: balance.available,
        connectionsLeft: balance.connectionsLeft,
        daysLeft: balance.daysLeft,
        low: balance.low,
        empty: balance.empty,
        advice: balanceAdvice(balance),
        contract: escrowContractAddress(),
      }}
      health={{
        network: process.env.VANA_NETWORK === "moksha" ? "moksha" : "mainnet",
        storagePersistent: isPersistent(),
        storageWritable: store.ok,
        storageError: store.failedAt ? `${store.failedAt}: ${store.error ?? ""}` : undefined,
        botProtection: altchaConfigured(),
        sharedSigningKey: usingSharedKey(),
        signer: signerCheck(),
      }}
    />
  );
}
