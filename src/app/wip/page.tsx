import type { Metadata } from "next";
import { WipLock } from "../components/WipLock";

export const metadata: Metadata = {
  title: "Work in progress",
  robots: { index: false, follow: false },
};

export default function WipPage() {
  return <WipLock />;
}
