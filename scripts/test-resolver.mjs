/**
 * Teaches the test runner the "@/" import alias.
 *
 * The app is written against tsconfig's `paths`, so route handlers import
 * `@/lib/store` rather than `../../../lib/store.ts`. TypeScript understands
 * that and plain Node does not, which is the only reason the API routes could
 * not be imported into a test at all. Twenty lines of resolver is a much better
 * answer than rewriting every import in the app to suit the test runner.
 *
 * Loaded with --import, so it is registered before any test module is resolved.
 * It touches nothing except specifiers beginning with "@/", and appends the
 * extension Node needs, so it cannot change how anything else resolves.
 */
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Next ships `headers` as a bare CommonJS file with no exports map and no
 * extension on the specifier, which plain Node cannot resolve and the test
 * runner's mock loader therefore cannot intercept. Pointing it at the real file
 * is what lets a test replace it with a cookie jar.
 */
const NEXT_SHIMS = new Map([
  ["next/headers", path.join(root, "node_modules", "next", "headers.js")],
]);

registerHooks({
  resolve(specifier, context, nextResolve) {
    const shim = NEXT_SHIMS.get(specifier);
    if (shim && existsSync(shim)) {
      return { url: pathToFileURL(shim).href, shortCircuit: true };
    }

    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);

    const base = path.join(root, "src", specifier.slice(2));

    // The app omits extensions; Node requires them. Try what a TypeScript
    // project would mean by this path, in the order TypeScript would.
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
      if (existsSync(candidate) && !candidate.endsWith(path.sep)) {
        return { url: pathToFileURL(candidate).href, shortCircuit: true };
      }
    }

    // Not ours to resolve after all. Let the default resolver produce the
    // error, so the message names the real problem rather than this file.
    return nextResolve(specifier, context);
  },
});
