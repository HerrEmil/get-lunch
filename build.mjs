import { build } from "esbuild";
import { cpSync } from "fs";

const shared = {
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  external: ["@aws-sdk/*"],
  minify: false,
  sourcemap: true,
};

// Bundle data-collector (includes jsdom)
await build({
  ...shared,
  entryPoints: ["src/lambdas/data-collector.mjs"],
  outfile: "dist/data-collector/index.js",
});

// Bundle api-server (lightweight, no jsdom)
await build({
  ...shared,
  entryPoints: ["src/lambdas/api-server.mjs"],
  outfile: "dist/api-server/index.js",
});

// Copy index.html for api-server (read at runtime via readFileSync)
cpSync("index.html", "dist/api-server/index.html");

console.log("Build complete");
