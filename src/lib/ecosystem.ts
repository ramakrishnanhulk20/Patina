/**
 * Other apps a person can spend their connected data on.
 *
 * Built for the Vana Cup, where data WE brought into the network being read by
 * someone else's app scored double a sign-up. Sending our users onward was
 * therefore worth more than keeping them, and chasing that is what won it.
 *
 * The scoring is gone and the list stays, because the reason underneath it was
 * never the competition. Patina's entire claim is that data connected here is
 * portable, and this is the one place a person can watch that be true. We get
 * nothing from these apps and they get nothing from us.
 *
 * The list is HAND PICKED and static. There used to be a live fetch of Vana's
 * builder leaderboard alongside it, kept "for the admin page to suggest from",
 * which nothing had called since the admin page was retired. Dead code that
 * reads like a working feature is worse than no code: it invited somebody to
 * put an unvetted third-party app in front of our users, and its
 * do-not-recommend list was already comparing against the wrong address after
 * the signing key was separated. Removed rather than left to rot.
 */

export type EcosystemApp = {
  name: string;
  url: string;
  description: string | null;
  icon: string | null;
};


/**
 * The apps we actually recommend, chosen by hand.
 *
 * Pinned rather than pulled from the live leaderboard, for two reasons the
 * leaderboard itself demonstrated. Career Quest carries no description there,
 * and the quality bar below drops anything without one, so the best app on the
 * list was the one that never appeared. And the feed holds a duplicate
 * Joblessing entry whose URL is missing its last character, which would have
 * sent our users to a dead domain.
 *
 * Descriptions are the builders' own words, taken from the leaderboard or from
 * the app's own page. We do not write copy about somebody else's product.
 *
 * This list is destined for the admin page, so it can be edited without a
 * deploy. Until that ships it lives here.
 */
const PINNED: EcosystemApp[] = [
  {
    name: "Career Quest",
    url: "https://vana-career-coach.vercel.app",
    description:
      "Connect your LinkedIn and get instant, honest insights about your career trajectory.",
    icon: "https://vana-career-coach.vercel.app/icon.svg",
  },
  {
    name: "DreamTape",
    url: "https://hello-friend--senadii555.replit.app/",
    description:
      "Turns your Vana data into cinematic short films with poetic narrative and chapter cards.",
    icon: "https://hello-friend--senadii555.replit.app/icon-512.png",
  },
  {
    name: "Joblessing",
    url: "https://joblessing.vercel.app",
    description:
      "Turns your LinkedIn profile into an honest signal check, one practical edit and a clear next step.",
    icon: "https://joblessing.vercel.app/app-icon.png",
  },
  {
    name: "67 Card",
    url: "https://vana-six.vercel.app",
    description: "Get your viral AI persona status card and roast powered by Vana data.",
    icon: "https://vana-six.vercel.app/icon.png",
  },
];

/** Apps worth sending someone to. */
export async function ecosystemApps(limit = 4): Promise<EcosystemApp[]> {
  return PINNED.slice(0, limit);
}

