import { build, transform } from "esbuild";
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { computeCollectorPatterns } from "./tools/collector-package-patterns.mjs";

// jsdom + pdfjs-dist are kept external and lazy-loaded at parser call sites.
// They ship to Lambda via serverless.yml package.patterns and resolve from
// node_modules at runtime — keeps the Lambda bundle far below the 5 MB cap.
const shared = {
  bundle: true,
  platform: "node",
  target: "node24",
  format: "cjs",
  external: ["@aws-sdk/*", "jsdom", "pdfjs-dist", "pdfjs-dist/legacy/build/pdf.mjs"],
  minify: true,
  sourcemap: false,
  banner: {
    js: 'var importMetaUrl = require("url").pathToFileURL(__filename).href;',
  },
  define: {
    "import.meta.url": "importMetaUrl",
  },
};

await build({
  ...shared,
  entryPoints: ["src/lambdas/data-collector.mjs"],
  outfile: "dist/data-collector/index.js",
});

await build({
  ...shared,
  entryPoints: ["src/lambdas/api-server.mjs"],
  outfile: "dist/api-server/index.js",
});

// index.html ships JSX compiled in-browser by @babel/standalone for dev. For
// production we precompile that inline script with esbuild (classic JSX ->
// React.createElement, matching the UMD React global) and drop the Babel CDN
// script, so browsers don't run the in-browser transformer. Target es2020 so
// `const lunches = [];` survives verbatim — api-server string-replaces that
// exact line to inject data at runtime.
const html = readFileSync("src/lambdas/index.html", "utf-8");
const scriptRe = /<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/;
const jsx = html.match(scriptRe);
if (!jsx) throw new Error("Could not find inline text/babel script in index.html");
const { code } = await transform(jsx[1], { loader: "jsx", target: "es2020" });
// Function replacers avoid `$&`/`$1` being interpreted in the compiled code.
const compiledHtml = html
  .replace(/[ \t]*<script src="https:\/\/unpkg\.com\/@babel\/standalone[^>]*><\/script>\n?/, "")
  .replace(scriptRe, () => `<script>\n${code}</script>`);
writeFileSync("dist/api-server/index.html", compiledHtml);

// Derive the dataCollector Lambda's package.patterns from jsdom's dependency
// closure; serverless.yml reads this via ${file(...)}. See tools/collector-package-patterns.mjs.
const collectorPatterns = computeCollectorPatterns(
  path.join(process.cwd(), "node_modules"),
);
writeFileSync(
  "dist/collector-package-patterns.json",
  JSON.stringify(collectorPatterns, null, 2),
);

console.log("Build complete");
