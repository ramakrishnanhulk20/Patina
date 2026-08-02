/**
 * What each source needs from the user before we hand them to Vana.
 *
 * The problem this solves: Vana's approval page asks for the PUBLIC PROFILE URL
 * of the account being connected, because server-side collection works by
 * reading a public page. That is a reasonable thing for it to ask and we cannot
 * change it, but most people do not know their own channel URL, have never
 * needed it, and are being asked for it on somebody else's website halfway
 * through a flow they only half trust.
 *
 * So we prepare them here instead. Ask for the thing they DO know (their
 * handle OR a pasted profile link), build the URL for them, put it on their
 * clipboard on the way out. When the box appears on the next screen, the answer
 * is already sitting in their paste buffer.
 *
 * No SDK imports: this file is shared with client components.
 */

export type SourceId =
  | "youtube"
  | "instagram"
  | "github"
  | "spotify"
  | "linkedin"
  | "amazon"
  | "uber"
  | "steam";

export type SourceSpec = {
  id: SourceId;
  /**
   * "web" — collected from a public URL by Vana's servers, no app, works on any
   * phone. "desktop" — collected through Vana's DataConnect app on a computer.
   * Absent means web. Desktop sources live in their own section and are not
   * tappable on a phone, because a phone cannot run the app.
   */
  kind?: "web" | "desktop";
  /**
   * Not yet available in Vana (shown there as "coming soon", or not listed at
   * all). The source stays defined and scored, but is non-connectable until Vana
   * ships it — at which point this flips off and the connect button returns.
   */
  comingSoon?: boolean;
  label: string;
  /** The single scope we read. See the note in vana.ts on why it is one. */
  scopes: string[];
  blurb: string;
  /**
   * What the user types. Null when there is nothing we can build for them.
   *
   * The URL is a TEMPLATE STRING, not a function, because these specs are built
   * on the server and handed to a client component, and React cannot serialise
   * a function across that boundary. It typechecks and it builds; it just
   * throws the moment the page renders.
   */
  handle: {
    /** Shown before the input, e.g. "youtube.com/@". */
    prefix: string;
    placeholder: string;
    /** Contains `{handle}`, replaced with the cleaned input. */
    urlTemplate: string;
    /** How to find it, if they do not know it off the top of their head. */
    hint: string;
  } | null;
  /** Shown when we cannot build the URL and they have to fetch it themselves. */
  findIt: string[] | null;
};

/** Hosts that count as "this platform" when someone pastes a mobile or bare URL. */
const PLATFORM_HOSTS: Partial<Record<SourceId, string[]>> = {
  youtube: ["youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"],
  instagram: ["instagram.com", "www.instagram.com", "m.instagram.com"],
  github: ["github.com", "www.github.com"],
  linkedin: ["linkedin.com", "www.linkedin.com", "m.linkedin.com"],
  spotify: ["open.spotify.com", "spotify.com"],
};

/** Strip what people actually paste: full URLs, leading @, stray spaces. */
export function cleanHandle(input: string): string {
  return input
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(
      /^(www\.)?(m\.)?(music\.)?(youtube\.com|instagram\.com|github\.com|linkedin\.com)\/?/i,
      "",
    )
    .replace(/^in\//i, "")
    .replace(/^@/, "")
    .replace(/\/+$/, "")
    .split(/[/?#]/)[0]
    .trim();
}

export const SOURCE_SPECS: Record<SourceId, SourceSpec> = {
  youtube: {
    id: "youtube",
    label: "YouTube",
    scopes: ["youtube.profile"],
    blurb: "The day your account was opened.",
    handle: {
      prefix: "youtube.com/@",
      placeholder: "yourhandle or paste channel link",
      urlTemplate: "https://www.youtube.com/@{handle}",
      hint: "Paste your channel link if you have one (works for /@, /channel/, /c/). Or type the @ handle from your picture menu.",
    },
    findIt: null,
  },
  instagram: {
    id: "instagram",
    label: "Instagram",
    // instagram.profile, NOT instagram.posts.
    //
    // We briefly switched to instagram.posts because the docs list it as
    // Data-Pipe (web) collectable and it carries dates. A live connect proved
    // otherwise: on the web path it demands the Data Connect DESKTOP app, which
    // for this audience means they leave. The docs are unreliable in both
    // directions — they were wrong about LinkedIn working, and wrong about
    // posts working — so the only truth is a real connect on a phone.
    //
    // So the profile it is. It has no date, so Instagram feeds Depth and
    // Standing rather than Age, which is a smaller contribution but a real one
    // that costs nobody an install.
    scopes: ["instagram.profile"],
    // Not "how long": the web profile scope carries counts, not dates, so
    // Instagram feeds Depth and Standing rather than Age. See vana.ts.
    blurb: "How much you post, and how many follow you.",
    handle: {
      prefix: "instagram.com/",
      placeholder: "yourusername or paste profile link",
      urlTemplate: "https://www.instagram.com/{handle}",
      hint: "Your username, or paste your profile link. Reels/posts links are fine — we trim them.",
    },
    findIt: null,
  },
  github: {
    id: "github",
    label: "GitHub",
    scopes: ["github.profile"],
    blurb: "When you joined and what you have built.",
    handle: {
      prefix: "github.com/",
      placeholder: "yourusername or paste profile link",
      urlTemplate: "https://github.com/{handle}",
      hint: "Your GitHub username, or paste your profile link.",
    },
    findIt: null,
  },
  linkedin: {
    id: "linkedin",
    label: "LinkedIn",
    scopes: ["linkedin.profile"],
    // Web LinkedIn has no join date in the published schema — it mainly adds
    // breadth and a connections signal. Still worth connecting.
    blurb: "Another independent account, and who is connected to you.",
    handle: {
      prefix: "linkedin.com/in/",
      placeholder: "your-name or paste /in/ link",
      urlTemplate: "https://www.linkedin.com/in/{handle}",
      hint: "Open your LinkedIn profile and paste the link (must include /in/). Or type the bit after /in/.",
    },
    findIt: null,
  },
  spotify: {
    id: "spotify",
    label: "Spotify",
    scopes: ["spotify.profile"],
    blurb: "A listening life.",
    // Spotify profile URLs contain an opaque id, not a username, so there is
    // nothing we can build from something the user already knows. This one gets
    // instructions instead of a shortcut.
    handle: null,
    findIt: [
      "Open Spotify and go to your own profile.",
      "Tap the three dots, then Share, then Copy link to profile.",
      "Come back here and paste it on the Vana page when it asks.",
    ],
  },

  // --- Desktop sources ---------------------------------------------------
  // Collected through Vana's DataConnect app, not the web path, so they carry
  // deeper, timestamped history but need a computer. They show in a separate
  // section and are not tappable on a phone.
  amazon: {
    id: "amazon",
    kind: "desktop",
    comingSoon: true,
    label: "Amazon",
    scopes: ["amazon.orders"],
    blurb: "Years of orders — a long, dull, unmistakably human paper trail.",
    handle: null,
    findIt: [
      "On a computer, install Vana's DataConnect app.",
      "Connect Amazon there and sign in; it reads your own order history.",
      "Come back to this page on that computer and connect Amazon.",
    ],
  },
  uber: {
    id: "uber",
    kind: "desktop",
    comingSoon: true,
    label: "Uber",
    scopes: ["uber.trips"],
    blurb: "How far back your rides go, and how many.",
    handle: null,
    findIt: [
      "On a computer, install Vana's DataConnect app.",
      "Connect Uber there and sign in; it reads your own trip history.",
      "Come back to this page on that computer and connect Uber.",
    ],
  },
  steam: {
    id: "steam",
    kind: "desktop",
    comingSoon: true,
    label: "Steam",
    scopes: ["steam.profile"],
    blurb: "The day your Steam account was created.",
    handle: null,
    findIt: [
      "On a computer, install Vana's DataConnect app.",
      "Connect Steam there and sign in; it reads your account and level.",
      "Come back to this page on that computer and connect Steam.",
    ],
  },
};

export const SOURCE_ORDER: SourceId[] = ["youtube", "instagram", "github", "linkedin", "spotify"];

/** Desktop-only sources, shown in their own section. */
export const DESKTOP_ORDER: SourceId[] = ["amazon", "uber", "steam"];

/**
 * The public profile URL Vana will ask for, or an empty string if we cannot
 * build one.
 *
 * Two paths. If the person pasted a FULL profile URL for this platform, we
 * preserve their exact path — this is what fixes the widespread "could not
 * connect this public profile" failures. Reconstructing from a bare handle
 * only knows one URL shape (youtube.com/@handle), but a huge share of real
 * YouTube accounts are youtube.com/channel/UC…, /c/Name or /user/Name, and
 * collapsing those to a single word produced a broken URL Vana could not
 * resolve. A pasted URL carries the real shape.
 *
 * Otherwise we build from the bare handle via the template. Either way the
 * result is pinned to the platform's own host, so a handle can never point the
 * URL somewhere else.
 */
export function buildProfileUrl(spec: SourceSpec, rawHandle: string): string {
  if (!spec.handle) return "";
  const raw = rawHandle.trim();
  if (!raw) return "";

  const pasted = canonicalPlatformUrl(spec, raw);
  if (pasted) return pasted;

  const handle = cleanHandle(raw);
  if (!handle) return "";
  return spec.handle.urlTemplate.replace("{handle}", encodeURIComponent(handle));
}

/**
 * If `raw` is a full URL on this platform's own host, return it normalised,
 * path and all. Returns "" for a bare handle or an off-platform URL, so the
 * caller falls back to the template and nothing off-host can slip through.
 */
function canonicalPlatformUrl(spec: SourceSpec, raw: string): string {
  if (!spec.handle) return "";

  let canonicalHost: string;
  try {
    canonicalHost = new URL(spec.handle.urlTemplate.replace("{handle}", "x")).host;
  } catch {
    return "";
  }

  // Add a scheme only when the input already looks like a domain with a path,
  // so a bare handle ("ramkumar") is never mistaken for a URL.
  const withScheme = /^https?:\/\//i.test(raw)
    ? raw
    : /^[a-z0-9-]+(\.[a-z0-9-]+)+\/\S/i.test(raw)
      ? `https://${raw}`
      : "";
  if (!withScheme) return "";

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return "";
  }

  const bare = (value: string) => value.replace(/^www\./i, "").toLowerCase();
  const allowed = new Set(
    (PLATFORM_HOSTS[spec.id] ?? [canonicalHost]).map((host) => bare(host)),
  );
  if (!allowed.has(bare(url.host))) return "";

  const path = profilePathFor(spec.id, url);
  if (!path) return "";

  return `https://${canonicalHost}${path}`;
}

/**
 * Trim deep links down to the profile root Vana's collector expects.
 *
 * Instagram share sheets often give /username/reels or /p/…. LinkedIn must
 * keep /in/slug. YouTube must keep /@, /channel/, /c/, /user/ intact.
 */
function profilePathFor(id: SourceId, url: URL): string {
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length === 0) return "";

  if (id === "instagram") {
    const user = parts[0];
    // Reserved Instagram path segments are not usernames.
    if (["p", "reel", "reels", "stories", "explore", "accounts"].includes(user.toLowerCase())) {
      return "";
    }
    return `/${encodeURIComponent(user)}`;
  }

  if (id === "linkedin") {
    const inIndex = parts.findIndex((part) => part.toLowerCase() === "in");
    if (inIndex === -1 || !parts[inIndex + 1]) return "";
    return `/in/${encodeURIComponent(parts[inIndex + 1])}`;
  }

  if (id === "github") {
    const user = parts[0];
    if (["settings", "login", "orgs", "marketplace", "topics"].includes(user.toLowerCase())) {
      return "";
    }
    return `/${encodeURIComponent(user)}`;
  }

  if (id === "youtube") {
    // youtu.be is a video shortlink, not a channel — refuse it.
    if (bareHost(url.host) === "youtu.be") return "";

    const head = parts[0].toLowerCase();
    if (head === "channel" || head === "c" || head === "user") {
      if (!parts[1]) return "";
      return `/${head}/${encodeURIComponent(parts[1])}`;
    }
    if (parts[0].startsWith("@")) {
      // Keep the @ literal. Encoding it to %40 is a common reason Vana rejects
      // an otherwise fine channel URL.
      return `/@${encodeURIComponent(parts[0].slice(1))}`;
    }
    // /watch, /shorts, /playlist are not profiles.
    if (["watch", "shorts", "playlist", "feed", "results"].includes(head)) return "";
    // Bare custom path without @ — treat as a handle.
    return `/@${encodeURIComponent(parts[0])}`;
  }

  return `/${parts.map((part) => encodeURIComponent(part)).join("/")}`;
}

function bareHost(value: string): string {
  return value.replace(/^www\./i, "").toLowerCase();
}
