import { build } from "esbuild";
import { cpSync, mkdirSync } from "fs";

const shared = {
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  external: ["@aws-sdk/*"],
  minify: false,
  sourcemap: true,
};

// Bundle data-collector (includes jsdom)
await build({
  ...shared,
  entryPoints: ["src/lambdas/data-collector.mjs"],
  outfile: "dist/data-collector/index.mjs",
});

// Bundle api-server (lightweight, no jsdom)
await build({
  ...shared,
  entryPoints: ["src/lambdas/api-server.mjs"],
  outfile: "dist/api-server/index.mjs",
});

// Copy index.html for api-server (read at runtime via readFileSync)
cpSync("index.html", "dist/api-server/index.html");

console.log("Build complete");
