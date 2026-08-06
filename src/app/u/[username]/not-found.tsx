import Link from "next/link";
import { SectionLabel } from "../../components/SectionLabel";

export const metadata = { title: "No such card" };

/**
 * A card that is not there.
 *
 * Separate from the generic 404 because the visitor arrived with an
 * expectation: somebody told them there was a score here. Saying "page not
 * found" answers the wrong question. Saying "that name is not taken" answers
 * the right one and points at the obvious next move, which is to take it.
 */
export default function CardNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-5 py-16 sm:px-6 sm:py-24">
      <SectionLabel>Patina card</SectionLabel>

      <h1 className="t-section mt-5 text-text">Nobody holds that name.</h1>

      <p className="mt-5 text-lg leading-relaxed text-text-2">
        The card you were sent has either been renamed, or the link lost a character on the way
        here. Names are first come, first served, so if that one was yours, it is still free.
      </p>

      <div className="mt-9 flex flex-wrap gap-3">
        <Link href="/connect" className="btn btn-primary px-6 py-3.5 text-base">
          Claim it and get a score
        </Link>
        <Link href="/standings" className="btn btn-ghost px-6 py-3.5 text-base">
          See the standings
        </Link>
      </div>
    </main>
  );
}
