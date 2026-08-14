/**
 * Length-independent string comparison, for secrets.
 *
 * A plain `===` on a token returns as soon as two bytes differ, so how long it
 * takes to say no depends on how much of the secret the caller got right. That
 * is enough to recover a token one character at a time. This always walks the
 * same amount of work regardless of where, or whether, the inputs diverge.
 *
 * Lived inside the admin route until the work-in-progress unlock needed the
 * same guarantee. Two copies of a security primitive is one copy too many, so
 * it lives here and both import it.
 */
export function safeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);

  if (left.length !== right.length) {
    // Still walk a fixed amount of work rather than returning immediately.
    let sink = 0;
    for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
      sink |= (left[i] ?? 0) ^ (right[i] ?? 0);
    }
    return sink === -1; // Never true; the loop exists only to burn the time.
  }

  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i];
  return diff === 0;
}
