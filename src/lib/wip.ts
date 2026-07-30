/**
 * Flip to false when Vana Data Pipe connect is working again.
 * While true, every page route shows the work-in-progress lock screen
 * unless the visitor has unlocked with the admin password.
 */
export const APP_WIP = true;

/** HttpOnly cookie set by /api/wip-unlock after a correct password. */
export const WIP_UNLOCK_COOKIE = "patina_wip_ok";
