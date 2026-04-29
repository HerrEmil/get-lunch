import { build } from "esbuild";
import { cpSync } from "fs";

// jsdom + pdfjs-dist are kept external and lazy-loaded at parser call sites.
// They ship to Lambda via serverless.yml package.patterns and resolve from
// node_modules at runtime — keeps the Lambda bundle far below the 5 MB cap.
const shared = {
  bundle: true,
  platform: "node",
  target: "node22",
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

console.log("Build complete");
