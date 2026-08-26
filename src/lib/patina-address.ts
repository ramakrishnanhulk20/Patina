/**
 * Patina's published signing address, in exactly one place.
 *
 * This value was being retyped by hand in the docs page, the MCP layer and the
 * offline verifier, and a hand-typed 42-character hex string is a guaranteed
 * eventual typo. One did in fact slip into a docs snippet (a doubled character
 * in the middle), which would have shipped an example that silently reports
 * every genuine Patina attestation as forged. That is the most damaging
 * possible bug in a verification snippet, because it is quiet and it makes
 * Patina look like the liar.
 *
 * So: import it, never retype it. Deriving the lowercase form from here also
 * means comparisons cannot drift from the display form.
 *
 * Confirmed against the live API on 14 August 2026. Note this is NOT the
 * address in `.app-identity.txt`, which holds an older testnet identity
 * (0x4791d4...) that production does not sign with.
 */
export const PATINA_APP_ADDRESS = "0x3989bdFaf3BA242d27B4D0cEed98F446d0c52DAD";

/** The comparison form. Recovered addresses should be lowercased to match. */
export const PATINA_APP_ADDRESS_LOWER = PATINA_APP_ADDRESS.toLowerCase();
