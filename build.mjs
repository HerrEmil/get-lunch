import { build } from "esbuild";
import { cpSync, readFileSync } from "fs";

// Plugin to inline jsdom's default-stylesheet.css at build time
// jsdom reads it via readFileSync at runtime, which breaks in bundled output
const inlineJsdomCss = {
  name: "inline-jsdom-css",
  setup(build) {
    build.onLoad(
      { filter: /jsdom\/lib\/jsdom\/living\/css\/helpers\/computed-style\.js$/ },
      async (args) => {
        let contents = readFileSync(args.path, "utf8");
        const cssPath =
          "node_modules/jsdom/lib/jsdom/browser/default-stylesheet.css";
        const css = readFileSync(cssPath, "utf8");
        // Replace the readFileSync call with the inlined CSS string
        contents = contents.replace(
          /fs\.readFileSync\(\s*path\.resolve\(__dirname,\s*"[^"]*default-stylesheet\.css"\)\s*,\s*\{[^}]*\}\s*\)/,
          JSON.stringify(css),
        );
        return { contents, loader: "js" };
      },
    );
  },
};

const shared = {
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  external: ["@aws-sdk/*"],
  minify: false,
  sourcemap: true,
  define: {
    "import.meta.url": "importMetaUrl",
  },
  // Polyfill import.meta.url for ESM libs bundled as CJS (css-tree uses createRequire)
  banner: {
    js: 'var importMetaUrl = require("url").pathToFileURL(__filename).href;',
  },
};

// Bundle data-collector (includes jsdom)
await build({
  ...shared,
  entryPoints: ["src/lambdas/data-collector.mjs"],
  outfile: "dist/data-collector/index.js",
  plugins: [inlineJsdomCss],
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
