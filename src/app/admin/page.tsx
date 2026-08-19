import type { Metadata } from "next";
import { adminConfigured, isAdmin } from "@/lib/admin";
import { AdminGate } from "./AdminGate";
import { AdminConsole } from "./AdminConsole";

export const dynamic = "force-dynamic";

/**
 * The operator console.
 *
 * Exists so a payout can be decided and settled without anybody reading the
 * database by hand. It is the only page in Patina that shows one person another
 * person's details, so it is gated, never indexed, and shows only the fields a
 * payout actually needs. Connected account ids are not among them.
 */
export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  if (!adminConfigured()) {
    return (
      <main className="mx-auto w-full max-w-2xl px-5 py-20 sm:px-6">
        <h1 className="t-section text-text">Admin is not configured.</h1>
        <p className="mt-4 leading-relaxed text-text-2">
          Set <span className="t-mono text-text">ADMIN_PASSWORD</span> in the environment and
          redeploy. Until then this page refuses everyone, which is the correct direction for a
          page that lists real people.
        </p>
      </main>
    );
  }

  if (!(await isAdmin())) {
    return <AdminGate />;
  }

  return <AdminConsole />;
}
