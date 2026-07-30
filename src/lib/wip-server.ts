import { cookies } from "next/headers";
import { APP_WIP, WIP_UNLOCK_COOKIE } from "@/lib/wip";

/** True when the WIP gate should hide the normal app chrome. */
export async function isWipLocked(): Promise<boolean> {
  if (!APP_WIP) return false;
  const store = await cookies();
  return store.get(WIP_UNLOCK_COOKIE)?.value !== "1";
}
