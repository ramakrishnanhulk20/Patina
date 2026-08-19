"use client";

import { usePathname } from "next/navigation";
import { AppNav } from "./AppNav";

/**
 * Decides which chrome wraps the page.
 *
 * The landing carries its own floating nav and its own footer, so the app's top
 * bar and mobile tab bar are suppressed there (and with them the bottom padding
 * that clears the tab bar). Every other route keeps the normal app chrome. When
 * the WIP lock is on, nothing but the lock screen renders.
 */
export function SiteChrome({
  locked,
  claimLive,
  children,
}: {
  locked: boolean;
  /** Whether /rewards still exists. Decided on the server; see claimPageLive. */
  claimLive: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/";

  if (locked) return <>{children}</>;

  if (pathname === "/") {
    return <div className="flex flex-1 flex-col">{children}</div>;
  }

  return (
    <>
      <AppNav claimLive={claimLive} />
      {/* Clears the fixed mobile tab bar so nothing sits underneath it. */}
      <div className="flex flex-1 flex-col pb-[calc(56px+env(safe-area-inset-bottom))] sm:pb-0">
        {children}
      </div>
    </>
  );
}
