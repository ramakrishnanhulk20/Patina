import { ConnectProbe } from "./ConnectProbe";
import { SOURCES, appAddress } from "@/lib/vana";

export const dynamic = "force-dynamic";

export default function LabPage() {
  const network = process.env.VANA_NETWORK === "mainnet" ? "mainnet" : "moksha";

  let address = "not configured";
  try {
    address = appAddress();
  } catch {
    // VANA_APP_PRIVATE_KEY missing; the banner below says so.
  }

  return (
    <main className="min-h-dvh bg-[#0B0C0B] px-6 py-14 text-white">
      <div className="mx-auto max-w-3xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#3EE148]">
          Patina · connect lab
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Does a real person get through this?
        </h1>
        <p className="mt-3 max-w-xl text-neutral-400">
          One button per source. Nothing here is the product. This page exists to
          prove the connect flow works end to end before a single line of Patina
          gets designed.
        </p>

        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-2 border-y border-white/10 py-4 font-mono text-[11px] sm:grid-cols-3">
          <div>
            <dt className="text-neutral-500">NETWORK</dt>
            <dd className="text-neutral-200">{network}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">FEE PER READ</dt>
            <dd className="text-neutral-200">
              {network === "mainnet" ? "0.01 USDC.e" : "0.01 VANA"}
            </dd>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <dt className="text-neutral-500">APP ADDRESS</dt>
            <dd className="break-all text-neutral-200">{address}</dd>
          </div>
        </dl>

        <div className="mt-8 space-y-4">
          {Object.values(SOURCES).map((source) => (
            <ConnectProbe
              key={source.id}
              source={{
                id: source.id,
                label: source.label,
                scopes: [...source.scopes],
                blurb: source.blurb,
              }}
            />
          ))}
        </div>

        <p className="mt-10 font-mono text-[11px] leading-relaxed text-neutral-500">
          WHAT WE ARE LOOKING FOR: no desktop install, the approval screen names
          Patina, the read returns real fields, and a payment receipt comes back.
          If any of those fail, the product plan changes.
        </p>
      </div>
    </main>
  );
}
