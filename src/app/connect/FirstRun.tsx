import { VANA_DESKTOP_DOWNLOAD } from "@/lib/device";

/**
 * What actually happens after you press Connect, said before you press it.
 *
 * THE GAP THIS CLOSES. The first connection is not a button, it is a
 * multi-minute errand across three applications: approve on Vana, open Vana
 * Desktop, sign in to the account inside it, wait for the import, come back.
 * Testing it end to end takes ten to fifteen minutes for a first-timer and
 * about ten for somebody comfortable with computers doing three or four
 * sources. The page presented all of that as a row of cards and one sentence
 * about needing a desktop app.
 *
 * Somebody who knows a job takes five minutes will wait five minutes. Somebody
 * who thought it was one click gives up at ninety seconds, and every waiting
 * state further down the flow is then trying to rescue a person who has already
 * decided they were misled. The cheapest fix in the whole funnel is telling
 * them first.
 *
 * NUMBERED BECAUSE IT IS ACTUALLY A SEQUENCE. These three happen in this order,
 * in three different places, and the order is the thing people lose. That is
 * what numbering is for; it is not decoration here.
 *
 * A server component: it renders once, holds no state, and never needs to be
 * shipped to the browser as JavaScript.
 */
export function FirstRun() {
  return (
    <section className="border border-line bg-panel p-6 sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <p className="t-label text-text-3">Before you start</p>
        <p className="text-xs text-text-4">
          About five minutes for the first one. A minute or two for each one after.
        </p>
      </div>

      <ol className="mt-6 grid gap-5 sm:grid-cols-3">
        <Step
          n={1}
          title="Approve on Vana"
          body="A Vana tab opens and asks you to approve exactly what Patina wants to read. Choose Open in Vana Desktop."
        />
        <Step
          n={2}
          title="Sign in, on your own machine"
          body="Vana Desktop opens a browser window and asks you to sign in to that account. This is the part that proves the account is yours. Patina never sees your password."
        />
        <Step
          n={3}
          title="Come back here"
          body="Leave both tabs open while it imports. Your score appears on this page by itself when it lands."
        />
      </ol>

      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-5">
        <a
          href={VANA_DESKTOP_DOWNLOAD}
          target="_blank"
          rel="noreferrer"
          className="tap t-label text-accent underline-offset-4 hover:underline"
        >
          Get Vana Desktop first
        </a>
        <p className="text-xs leading-relaxed text-text-4">
          Free for Mac, Windows and Linux. You need it installed before step one, and only once.
          Patina pays the small fee for reading your data.
        </p>
      </div>
    </section>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="flex flex-col gap-2">
      <div className="flex items-center gap-2.5">
        <span className="t-mono grid h-6 w-6 flex-none place-items-center rounded-full border border-accent/40 text-[11px] text-accent">
          {n}
        </span>
        <span className="font-semibold text-text">{title}</span>
      </div>
      <p className="text-[0.87rem] leading-relaxed text-text-2">{body}</p>
    </li>
  );
}
