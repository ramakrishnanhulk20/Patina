/**
 * The ten sources Patina reads, and what it tells people before it reads them.
 *
 * WHAT THIS FILE REPLACED. v1's sources.ts was two hundred lines of URL
 * machinery: `cleanHandle`, `buildProfileUrl`, `canonicalPlatformUrl`,
 * `profilePathFor`. All of it existed to solve one problem, which was that
 * Vana's server-side collection reads a PUBLIC PAGE and therefore needs the
 * public profile URL of the account being connected. Most people do not know
 * their own channel URL, so we built it for them and put it on their clipboard.
 *
 * Desktop collection does not read a public page. It opens a browser on the
 * user's own machine and asks them to sign in. There is no URL to guess,
 * because the account identifies itself by being logged into. The entire
 * apparatus is gone, and with it the single largest source of failed connects.
 *
 * WHAT REPLACED IT is the `reads` and `keeps` copy below. Vana's approval page
 * lists every requested scope by name, so somebody connecting LinkedIn will see
 * the words "connections", "experience" and "education" on a page that is not
 * ours, in language we did not write. If that is the first time they learn what
 * we are asking for, we have already lost them, and deservedly. So we say it
 * first, in our own words, on our own screen.
 *
 * No SDK imports: this file is shared with client components.
 */

import type { SourceId } from "./score.ts";

/** Re-exported so client components can reach it without importing the scorer. */
export type { SourceId };

export type Maturity = "stable" | "beta" | "experimental";

export type ScopeSpec = {
  id: string;
  /** What Vana calls it on the approval page, so the two screens match. */
  vanaLabel: string;
  /** What we actually read out of it. Plain English, no scope names. */
  reads: string;
  /** What survives after normalize. The honest half of the sentence. */
  keeps: string;
};

export type SourceSpec = {
  id: SourceId;
  label: string;
  /** One line, on the connect card. What this source is worth to the score. */
  blurb: string;
  /**
   * The scope that proves the read came from somebody signed in as themselves.
   *
   * THIS IS THE WHOLE OWNERSHIP ARGUMENT, and until now it was an assumption
   * rather than a check. Vana has two collection paths. Desktop runs a
   * connector in a browser on the user's own machine and makes them sign in.
   * The web path collects server-side, and server-side collection reads a
   * PUBLIC PAGE: that is what v1's `buildProfileUrl` existed to feed, turning a
   * typed handle into a profile URL for somebody else's infrastructure to
   * scrape. Nothing in the protocol reports which path a read came through, and
   * Vana's own documentation is explicit that the two server forms are meant to
   * be interchangeable to builders. So Patina cannot ask.
   *
   * What it can do is ask for something the public page does not have. v1 ran
   * on the web path and every scope it ever used was a `.profile` one, which is
   * the public page and nothing more. A request that includes a scope only a
   * signed-in session can produce cannot be served from a public page at all,
   * so the person is pushed onto Desktop and has to log in.
   *
   * Requesting it is only half of it. `readSourceSettled` treats partial
   * success as success, on purpose, so a source with three of four scopes still
   * counts. That rule is right for scoring and wrong for proof: it would let
   * the public scope succeed, the private one fail, and the source count
   * anyway. So this scope is REQUIRED to come back, and the read is refused
   * when it does not. See `requireProof` in api/vana/data.
   */
  proof: string;
  /**
   * Core sources are asked for first. Between them they carry nearly all the
   * Continuity and Vouch signal, and the first run is one source, one score, one
   * visible jump. Everything else lives behind "strengthen this", because the
   * Vana import is where people drop off and it is far easier to survive the
   * second time, once somebody has seen a number they care about.
   */
  tier: "core" | "strengthen";
  maturity: Maturity;
  scopes: ScopeSpec[];
  /**
   * Set when this source contains data about OTHER PEOPLE. Those scopes get an
   * extra line of explanation before the consent page, because asking for
   * somebody's contact list is a different kind of request from asking for their
   * own post history, and it should feel like one.
   */
  thirdParty?: string;
};

export const SOURCE_SPECS: Record<SourceId, SourceSpec> = {
  github: {
    id: "github",
    label: "GitHub",
    blurb: "Years of commits, pull requests and the people who responded to them.",
    /** Your pull request and issue history is not on your public profile page. */
    proof: "github.history",
    tier: "core",
    maturity: "stable",
    scopes: [
      {
        id: "github.history",
        vanaLabel: "History",
        reads: "Every pull request and issue you have opened, and when.",
        keeps: "The dates. Never the titles or the text you wrote.",
      },
      {
        id: "github.contributions",
        vanaLabel: "Contributions",
        reads: "Your contribution graph, day by day, for the last four years.",
        keeps: "How many contributions fell in each month.",
      },
      {
        id: "github.profile",
        vanaLabel: "Profile",
        reads: "Followers, organisations you belong to, and achievement badges.",
        keeps: "The counts.",
      },
      {
        id: "github.repositories",
        vanaLabel: "Repositories",
        reads: "The list of repositories on your profile.",
        keeps: "How many there are.",
      },
    ],
  },

  linkedin: {
    id: "linkedin",
    label: "LinkedIn",
    blurb: "When other people chose to connect to you, going back years.",
    /** Only you can see when each of your connections was made. */
    proof: "linkedin.connections",
    tier: "core",
    maturity: "stable",
    thirdParty:
      "Your connections list has other people's names in it. We read only the date each connection was made, and their names are discarded before anything is saved.",
    scopes: [
      {
        id: "linkedin.connections",
        vanaLabel: "Connections",
        reads: "The date each of your connections was made.",
        keeps: "Only those dates. Never names, headlines or profile links.",
      },
      {
        id: "linkedin.experience",
        vanaLabel: "Experience",
        reads: "The date ranges on your roles.",
        keeps: "The earliest year. Never employers, job titles or descriptions.",
      },
      {
        id: "linkedin.education",
        vanaLabel: "Education",
        reads: "The years on your education history.",
        keeps: "The earliest year. Never schools, degrees or grades.",
      },
      {
        id: "linkedin.profile",
        vanaLabel: "Profile",
        reads: "Your connection count.",
        keeps: "The number.",
      },
    ],
  },

  spotify: {
    id: "spotify",
    label: "Spotify",
    blurb: "A decade of saved tracks, each one stamped with the day you saved it.",
    /** Your saved tracks are private to your account. */
    proof: "spotify.savedTracks",
    tier: "core",
    maturity: "stable",
    scopes: [
      {
        id: "spotify.savedTracks",
        vanaLabel: "Saved tracks",
        reads: "When each track in your library was saved.",
        keeps: "How many you saved each month. Never the songs, artists or albums.",
      },
      {
        id: "spotify.playlists",
        vanaLabel: "Playlists",
        reads: "When tracks were added to your playlists.",
        keeps: "Those dates, and how many playlists you have.",
      },
      {
        id: "spotify.profile",
        vanaLabel: "Profile",
        reads: "Your follower count.",
        keeps: "The number.",
      },
    ],
  },

  instagram: {
    id: "instagram",
    label: "Instagram",
    blurb: "How far back your posts go, and how steadily they came.",
    /** The dates on your own posts, read from your account rather than the public grid. */
    proof: "instagram.posts",
    tier: "core",
    maturity: "stable",
    thirdParty:
      "Instagram sends the username of everyone who liked each post. We do not read that list at all, and it is thrown away before anything is saved.",
    scopes: [
      {
        id: "instagram.posts",
        vanaLabel: "Posts",
        reads: "The date each of your posts was taken.",
        keeps: "Only the dates. Never captions, images, likes, or who liked them.",
      },
      {
        id: "instagram.profile",
        vanaLabel: "Profile",
        reads: "Your follower and post counts.",
        keeps: "The numbers.",
      },
    ],
  },

  /**
   * STEAM IS GONE, and it is the one source that could not be saved.
   *
   * Every other connector opens a browser and asks for a password. Steam's does
   * not. It asks the user to paste a Steam Web API key and a Steam ID, then
   * calls Steam's public Web API, and its own prompt links to steamid.io to
   * look one up. A Steam ID is public. An API key authorises the caller, not
   * the subject. So anyone could take their own key, a stranger's Steam ID, and
   * hand Patina that stranger's account age, friendship dates and library as
   * their own evidence.
   *
   * It was also the worst possible source to lose that argument on. Steam is
   * usually the oldest account a person still has, and Age is the heaviest
   * component in the score. A forged Steam connection moved five of the six.
   *
   * The `proof` scope above cannot rescue it: Steam has no private scope to
   * require, because none of the three is private. Nothing here is fixable at
   * our end, so the source is withdrawn rather than qualified. If Valve or Vana
   * ship a connector that signs the user in, it can come back unchanged.
   *
   * Fragments already stored under steam.* are orphaned by this, which is the
   * intended outcome: `evidenceFrom` walks ALL_SCOPES, so a scope that is no
   * longer in the manifest stops being read and stops being scored.
   */

  youtube: {
    id: "youtube",
    label: "YouTube",
    blurb: "The day your account was opened.",
    /** Watch Later is never public. Nobody can see it but you. */
    proof: "youtube.watchLater",
    tier: "strengthen",
    maturity: "beta",
    scopes: [
      {
        id: "youtube.profile",
        vanaLabel: "Profile",
        // Said out loud because Vana's page will show this scope, and the scope
        // does return an email address. Better they hear it from us.
        reads: "Your join date, video count and subscriber count. Google also sends your email address.",
        keeps: "The join date and the counts. Your email is never read or stored.",
      },
      {
        /**
         * Asked for as PROOF, and for nothing else.
         *
         * YouTube was the one source whose entire request was a `.profile`
         * scope, which is the public About page and can be collected without
         * anybody signing in. Every other source already asked for something
         * private and so already forced the desktop path; this one did not, so
         * a join date could arrive for an account the person had never logged
         * into.
         *
         * Watch Later is the lightest private thing YouTube has. It is never
         * public, it is small, and it says far less about a person than their
         * watch history or their subscriptions would. Patina reads NOTHING out
         * of it: there is no reader for this scope in normalize.ts, so it
         * contributes no dates, no counts and no score. Its only job is to be
         * impossible to answer from a public page.
         */
        id: "youtube.watchLater",
        vanaLabel: "Watch later",
        reads: "Nothing. We ask for it only to prove you are signed in to this account.",
        keeps: "Nothing at all. Not the videos, not how many, not that it was empty.",
      },
    ],
  },

  amazon: {
    id: "amazon",
    label: "Amazon",
    blurb: "A long, dull, unmistakably human paper trail.",
    /** There is no public page anywhere that lists what you ordered. */
    proof: "amazon.orders",
    tier: "strengthen",
    maturity: "beta",
    scopes: [
      {
        id: "amazon.orders",
        vanaLabel: "Orders",
        reads: "The date of each order.",
        keeps: "How many orders fell in each month. Never what you bought or what it cost.",
      },
    ],
  },

  uber: {
    id: "uber",
    label: "Uber",
    blurb: "How far back your rides go.",
    /** There is no public page anywhere that lists your trips. */
    proof: "uber.trips",
    tier: "strengthen",
    maturity: "beta",
    scopes: [
      {
        id: "uber.trips",
        vanaLabel: "Trips",
        reads: "The date of each trip.",
        keeps: "The dates. Never pickup or dropoff addresses, fares, or cities.",
      },
    ],
  },

  doordash: {
    id: "doordash",
    label: "DoorDash",
    blurb: "Another independent record of ordinary weeks.",
    /** There is no public page anywhere that lists your orders. */
    proof: "doordash.orders",
    tier: "strengthen",
    maturity: "beta",
    scopes: [
      {
        id: "doordash.orders",
        vanaLabel: "Orders",
        reads: "The date of each order.",
        keeps: "The dates. Never restaurants, items or addresses.",
      },
    ],
  },

  shop: {
    id: "shop",
    label: "Shop",
    blurb: "Orders across many merchants, from one connection.",
    /** There is no public page anywhere that lists your orders. */
    proof: "shop.orders",
    tier: "strengthen",
    maturity: "beta",
    scopes: [
      {
        id: "shop.orders",
        vanaLabel: "Orders",
        reads: "The date of each order.",
        keeps: "The dates. Never merchants, items or totals.",
      },
    ],
  },
};

/** Asked for first. One source, one score, one visible jump. */
export const CORE_ORDER: SourceId[] = ["github", "linkedin", "spotify", "instagram"];

/** Offered afterwards, under "strengthen this". */
export const STRENGTHEN_ORDER: SourceId[] = [
  "youtube",
  "amazon",
  "uber",
  "doordash",
  "shop",
];

export const SOURCE_ORDER: SourceId[] = [...CORE_ORDER, ...STRENGTHEN_ORDER];

export function scopesFor(source: SourceId): string[] {
  return SOURCE_SPECS[source].scopes.map((scope) => scope.id);
}

/**
 * The scope this source must return before the read is allowed to count.
 *
 * Read through this helper rather than off the spec directly, so the one place
 * that decides what "proved" means is the same one the tests assert against.
 */
export function proofScopeFor(source: SourceId): string {
  return SOURCE_SPECS[source].proof;
}

/**
 * Why a source with no proof scope in it was refused, in the words the person
 * needs to hear. It names the missing thing without naming the scope, because
 * "youtube.watchLater did not come back" means nothing to anybody.
 */
export function proofMissingMessage(source: SourceId): string {
  const { label } = SOURCE_SPECS[source];
  return `Patina could not confirm you are signed in to ${label}. Connect it through Vana Desktop, which signs you in on your own machine, rather than through the browser.`;
}

export function isSourceId(value: string | null | undefined): value is SourceId {
  return typeof value === "string" && value in SOURCE_SPECS;
}

/**
 * The warning shown on connectors Vana has not finished hardening.
 *
 * Five of the nine are beta. When one of them returns nothing, the person needs
 * to understand it as a rough edge in the plumbing rather than as Patina
 * telling them they have no history.
 */
export function maturityNote(source: SourceId): string | null {
  const { maturity, label } = SOURCE_SPECS[source];
  if (maturity === "stable") return null;
  return maturity === "experimental"
    ? `${label} support is brand new and sometimes comes back empty. That is the connection failing, not your history.`
    : `${label} support is still being finished. If it comes back empty, try again later.`;
}
