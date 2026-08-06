import Link from "next/link";
import { SectionLabel } from "./components/SectionLabel";

export const metadata = { title: "Not found" };

/**
 * The 404, which matters more here than on most sites.
 *
 * Patina's only real distribution is a link somebody pasted into a chat. Those
 * links get truncated, retyped by hand, and go stale when a person changes
 * their name. Every one of those lands here, so this page is not an apology, 
 * it is the last chance to turn a mistyped URL into a user. Next's default 404
 * is a black page with system type and no way onward, which threw all of them
 * away.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-5 py-16 sm:px-6 sm:py-24">
      <SectionLabel>404</SectionLabel>

      <h1 className="t-section mt-5 text-text">There is nothing at this address.</h1>

      <p className="mt-5 text-lg leading-relaxed text-text-2">
        Either the link was cut short on its way to you, chat apps do that to long ones, or
        whoever sent it has since changed their name. Neither is worth your time chasing.
      </p>

      <div className="mt-9 flex flex-wrap gap-3">
        <Link href="/connect" className="btn btn-primary px-6 py-3.5 text-base">
          Get your own score
        </Link>
        <Link href="/" className="btn btn-ghost px-6 py-3.5 text-base">
          What Patina is
        </Link>
      </div>

      <p className="t-label mt-8 text-text-4">Free · About a minute · No wallet needed</p>
    </main>
  );
}
