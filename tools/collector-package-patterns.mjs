/**
 * Derives the serverless `package.patterns` for the dataCollector Lambda.
 *
 * jsdom + pdfjs-dist are kept external to the esbuild bundle and resolved from
 * node_modules at runtime, so every jsdom transitive dependency must be shipped
 * in the Lambda package. This list used to be hand-maintained in serverless.yml
 * and silently rotted whenever dependabot bumped jsdom's dependency tree (a
 * missing dep makes `require('jsdom')` throw and every DOM parser fails).
 *
 * Instead we compute jsdom's dependency closure here at build time. build.mjs
 * writes the result to dist/collector-package-patterns.json, which serverless.yml
 * reads via `${file(...)}`. pdfjs-dist has no required deps (only the optional,
 * deliberately-unshipped @napi-rs/canvas), so the closure is jsdom-only.
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

/**
 * Walk jsdom's required `dependencies` recursively and return the sorted set of
 * package names. Optional deps (e.g. @napi-rs/canvas) are not in `dependencies`,
 * so they're excluded automatically.
 *
 * Throws if a required package isn't found at top-level node_modules — a
 * non-hoisted or missing dep would otherwise silently produce a broken Lambda,
 * so we surface it loudly at build time.
 */
export function jsdomClosure(nodeModulesDir) {
  const seen = new Set();
  const visit = (name) => {
    if (seen.has(name)) return;
    seen.add(name);
    const pj = path.join(nodeModulesDir, name, "package.json");
    if (!existsSync(pj)) {
      throw new Error(
        `Cannot derive Lambda package patterns: required package "${name}" ` +
          `not found at ${pj} (non-hoisted or missing install?)`,
      );
    }
    const deps = JSON.parse(readFileSync(pj, "utf8")).dependencies ?? {};
    Object.keys(deps).forEach(visit);
  };
  visit("jsdom");
  seen.delete("jsdom");
  return [...seen].sort();
}

/** Build the full ordered `package.patterns` array for the dataCollector function. */
export function computeCollectorPatterns(nodeModulesDir) {
  const jsdomDeps = jsdomClosure(nodeModulesDir).map(
    (p) => `node_modules/${p}/**`,
  );

  return [
    "!**",
    "dist/data-collector/**",
    "node_modules/jsdom/**",
    "node_modules/pdfjs-dist/legacy/build/pdf.mjs",
    "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
    "node_modules/pdfjs-dist/package.json",
    // jsdom transitive deps (auto-derived; resolved by Node at runtime)
    ...jsdomDeps,
    // Excludes (last patterns win) — strip metadata, sourcemaps, type defs.
    "!**/*.md",
    "!**/*.markdown",
    "!**/*.map",
    "!**/*.ts",
    "!**/*.d.ts",
    "!**/*.d.mts",
    "!**/*.flow",
    "!**/LICENSE",
    "!**/LICENSE.txt",
    "!**/LICENSE.md",
    "!**/CHANGELOG.md",
    "!**/CHANGELOG",
    "!**/test/**",
    "!**/tests/**",
    "!**/__tests__/**",
    "!**/types/**",
    "!**/.github/**",
    "!**/example/**",
    "!**/examples/**",
    "!**/docs/**",
    // pdfjs-dist heavy directories we don't use
    "!node_modules/pdfjs-dist/build/**",
    "!node_modules/pdfjs-dist/web/**",
    "!node_modules/pdfjs-dist/legacy/web/**",
    "!node_modules/pdfjs-dist/legacy/image_decoders/**",
    "!node_modules/pdfjs-dist/image_decoders/**",
    "!node_modules/pdfjs-dist/cmaps/**",
    "!node_modules/pdfjs-dist/standard_fonts/**",
    "!node_modules/pdfjs-dist/wasm/**",
    "!node_modules/pdfjs-dist/iccs/**",
    "!node_modules/pdfjs-dist/legacy/build/pdf.sandbox*",
    "!node_modules/pdfjs-dist/legacy/build/pdf.min.mjs",
    "!node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    // tldts ships ESM/UMD/CJS minified variants — keep CJS only
    "!node_modules/tldts/dist/index.esm*",
    "!node_modules/tldts/dist/index.umd*",
    "!node_modules/tldts/dist/es6/**",
  ];
}
