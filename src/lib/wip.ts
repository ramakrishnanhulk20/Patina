/**
 * The upgrade lock.
 *
 * True while Patina is being rebuilt. Every page except the landing shows the
 * work-in-progress screen; the landing stays public so the site still explains
 * itself to anyone who arrives, and so shared links do not land on a wall.
 *
 * Getting past it needs WIP_PASSWORD, which is the only operator access that
 * survives: the admin console was removed along with the claim flow, so this is
 * how the work gets checked in production. Set it BEFORE flipping this to true,
 * because /api/wip-unlock fails closed and an unset password locks everybody
 * out, including whoever is doing the upgrading.
 *
 * Flip back to false when the rebuild ships.
 */
export const APP_WIP = true;

/** HttpOnly cookie set by /api/wip-unlock after a correct password. */
export const WIP_UNLOCK_COOKIE = "patina_wip_ok";
