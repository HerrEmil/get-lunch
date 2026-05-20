import { build } from "esbuild";
import { cpSync, writeFileSync } from "fs";
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

// index.html is read by api-server at runtime via readFileSync.
cpSync("src/lambdas/index.html", "dist/api-server/index.html");

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
