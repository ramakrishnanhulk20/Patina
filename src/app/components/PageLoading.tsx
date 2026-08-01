/**
 * Instant feedback while a page loads.
 *
 * The dynamic pages read from the store before they can render, so on a phone a
 * tap would otherwise sit on the previous screen with nothing happening — the
 * exact moment a web app feels slower than a native one. Next streams this the
 * instant a link is tapped, so every tap is answered at once.
 */
export function PageLoading() {
  return (
    <div
      className="flex min-h-[60vh] flex-1 items-center justify-center"
      role="status"
      aria-label="Loading"
    >
      <span
        className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-accent"
        aria-hidden="true"
      />
      <span className="sr-only">Loading</span>
    </div>
  );
}
