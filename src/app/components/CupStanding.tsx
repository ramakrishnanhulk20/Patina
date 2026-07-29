import Link from "next/link";
import { cupStanding, CUP_PAYING_PLACES, type CupStanding as Standing } from "@/lib/cup";

/**
 * The live Vana Cup scoreboard, for Patina's own position.
 *
 * Its whole job is to convert a reader into a sharer. The Cup is scored by
 * people brought into the network, so "we are 5th, on the last paying place"
 * is not a vanity number — it is the argument for sending the card to one more
 * person. The status shifts with the rank so the page never feels static:
 * comfortably in, clinging to the cutoff, or a stated number away from it.
 *
 * An async Server Component. It fetches its own data and renders NOTHING when
 * the Cup API is unreachable, so a third party being down can never leave a
 * broken panel on the page — it simply is not there.
 */
export async function CupStanding() {
  const standing = await cupStanding();
  if (!standing) return null;

  const { pill, tone, line } = framing(standing);
  const border =
    tone === "good"
      ? "border-accent/40"
      : tone === "warn"
        ? "border-warn/40"
        : "border-line-strong";
  const pillClass =
    tone === "good"
      ? "bg-accent-wash text-accent"
      : tone === "warn"
        ? "bg-warn/10 text-warn"
        : "bg-panel-2 text-text-2";
  const rankColor = tone === "warn" ? "text-warn" : tone === "out" ? "text-text" : "text-accent";

  return (
    <section className={`rounded-2xl border ${border} bg-panel p-5 sm:p-6`}>
      <div className="flex items-center justify-between gap-3">
        <span className="t-label flex items-center gap-2 text-text-3">
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 rounded-full ${
              standing.seasonLive ? "animate-pulse bg-accent" : "bg-text-4"
            }`}
          />
          Vana Cup{standing.seasonLive ? " · Live" : " · Final"}
        </span>
        <a
          href="https://builders.vana.org"
          target="_blank"
          rel="noreferrer"
          className="tap t-label text-text-4 underline-offset-4 transition hover:text-accent hover:underline"
        >
          builders.vana.org
        </a>
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <p className="flex items-end gap-2">
          <span className={`t-display ${rankColor}`}>#{standing.rank}</span>
          <span className="pb-2 text-lg text-text-3">of {standing.total}</span>
        </p>
        <span className={`t-label rounded-full px-3 py-1.5 ${pillClass}`}>{pill}</span>
      </div>

      <p className="mt-3 text-base leading-relaxed text-text-2">{line}</p>

      <dl className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line">
        <Stat label="Points" value={standing.points} />
        <Stat label="Goals" value={standing.goals} />
        <Stat label="People" value={standing.users} />
      </dl>

      <p className="mt-5 text-sm leading-relaxed text-text-3">
        {standing.championVana
          ? `The top ${CUP_PAYING_PLACES} share the Cup prize — about ${Math.round(
              standing.championVana,
            ).toLocaleString("en-US")} VANA to the winner right now, and it grows with every read.`
          : `The top ${CUP_PAYING_PLACES} share the Cup prize.`}{" "}
        Patina moves up when a new person connects through it. That is what your card is for.
      </p>

      <Link
        href="/connect"
        className="btn btn-primary mt-5 inline-flex w-full px-5 py-3 text-sm sm:w-auto"
      >
        Share your card
      </Link>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-panel px-4 py-3">
      <dt className="t-label text-text-3">{label}</dt>
      <dd className="t-mono mt-1 text-2xl text-text">{value.toLocaleString("en-US")}</dd>
    </div>
  );
}

/** A point count that reads naturally in a sentence: "1 point", "3 points". */
function pts(n: number): string {
  return `${n} ${n === 1 ? "point" : "points"}`;
}

/**
 * The line that shifts with the rank. Every branch is a different reason to
 * share, which is the point: comfortably in, clinging on, or a number away.
 */
function framing(s: Standing): { pill: string; tone: "good" | "warn" | "out"; line: string } {
  const cutoffPlace = CUP_PAYING_PLACES;
  const firstOutPlace = CUP_PAYING_PLACES + 1;

  if (!s.seasonLive) {
    return {
      pill: `Finished #${s.rank}`,
      tone: s.inTheMoney ? "good" : "out",
      line: s.inTheMoney
        ? `Patina finished in a paying place — inside the top ${cutoffPlace}.`
        : `Patina finished ${pts(s.margin)} outside the money.`,
    };
  }

  if (s.onTheBubble) {
    return {
      pill: "On the bubble",
      tone: "warn",
      line:
        s.margin === 0
          ? `Holding the last paying place, but level with ${firstOutPlace}th on points — only the tiebreak is keeping Patina in. One more person could settle it.`
          : `Holding the last paying place, ${pts(s.margin)} clear of ${firstOutPlace}th. One good push either way decides it.`,
    };
  }

  if (s.inTheMoney) {
    return {
      pill: "In the money",
      tone: "good",
      line:
        s.margin === 0
          ? "In a paying place, but level with the cutoff on points. Worth pulling clear."
          : `In a paying place, ${pts(s.margin)} clear of the cutoff.`,
    };
  }

  return {
    pill: `#${s.rank}`,
    tone: "out",
    line:
      s.margin === 0
        ? `Level with ${cutoffPlace}th on points, just outside the money. The next person through could be the difference.`
        : `${cap(pts(s.margin))} away from the top ${cutoffPlace}, which is where the prize is. Closer than it sounds.`,
  };
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
