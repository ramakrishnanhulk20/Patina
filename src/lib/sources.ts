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
 * So we prepare them here instead. Ask for the one thing they DO know (their
 * handle), build the URL for them, put it on their clipboard, and only then send
 * them over. By the time the box appears, the answer is already copied.
 *
 * No SDK imports: this file is shared with client components.
 */

export type SourceId = "youtube" | "instagram" | "github" | "spotify" | "linkedin";

export type SourceSpec = {
  id: SourceId;
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

/** Strip what people actually paste: full URLs, leading @, stray spaces. */
export function cleanHandle(input: string): string {
  return input
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^(www\.)?(youtube\.com|instagram\.com|github\.com|linkedin\.com)\/?/i, "")
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
      placeholder: "yourhandle",
      urlTemplate: "https://www.youtube.com/@{handle}",
      hint: "Open YouTube, tap your picture, and your handle is the bit starting with @.",
    },
    findIt: null,
  },
  instagram: {
    id: "instagram",
    label: "Instagram",
    // instagram.profile, NOT instagram.posts.
    //
    // Posts can only be collected by the Data Connect DESKTOP app. Asking for
    // them makes Vana tell a phone user to go and install software, which for
    // this audience means they leave. Requesting the profile keeps it a
    // web-only flow, which is the whole reason these sources were chosen.
    scopes: ["instagram.profile"],
    blurb: "How long you have been posting, and to how many.",
    handle: {
      prefix: "instagram.com/",
      placeholder: "yourusername",
      urlTemplate: "https://www.instagram.com/{handle}",
      hint: "Your username, the one shown at the top of your own profile.",
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
      placeholder: "yourusername",
      urlTemplate: "https://github.com/{handle}",
      hint: "Your GitHub username.",
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
      placeholder: "your-name",
      urlTemplate: "https://www.linkedin.com/in/{handle}",
      hint: "Open your LinkedIn profile. The bit after /in/ is your public name.",
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
      "Come back here and paste it below.",
    ],
  },
};

export const SOURCE_ORDER: SourceId[] = ["youtube", "instagram", "github", "linkedin", "spotify"];

/**
 * The public profile URL Vana will ask for, or an empty string if we cannot
 * build one. Encodes the handle so a stray character cannot produce a URL
 * pointing somewhere other than the profile.
 */
export function buildProfileUrl(spec: SourceSpec, rawHandle: string): string {
  if (!spec.handle) return "";
  const handle = cleanHandle(rawHandle);
  if (!handle) return "";
  return spec.handle.urlTemplate.replace("{handle}", encodeURIComponent(handle));
}
