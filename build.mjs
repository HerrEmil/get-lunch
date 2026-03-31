import { build } from "esbuild";
import { cpSync, readFileSync } from "fs";
import { dirname, resolve } from "path";

// Plugin to fix runtime file reads that break in bundled output.
// Rewrites source files at load time so esbuild can statically resolve them.
const fixRuntimeReads = {
  name: "fix-runtime-reads",
  setup(ctx) {
    // Inline jsdom's default-stylesheet.css (readFileSync at runtime)
    ctx.onLoad(
      { filter: /jsdom\/lib\/jsdom\/living\/css\/helpers\/computed-style\.js$/ },
      async (args) => {
        let contents = readFileSync(args.path, "utf8");
        const cssPath =
          "node_modules/jsdom/lib/jsdom/browser/default-stylesheet.css";
        const css = readFileSync(cssPath, "utf8");
        contents = contents.replace(
          /fs\.readFileSync\(\s*path\.resolve\(__dirname,\s*"[^"]*default-stylesheet\.css"\)\s*,\s*\{[^}]*\}\s*\)/,
          JSON.stringify(css),
        );
        return { contents, loader: "js" };
      },
    );

    // Replace createRequire(import.meta.url) with plain require() in css-tree.
    // css-tree is ESM and uses createRequire to load JSON files. In CJS bundle
    // output, require() is already available and can resolve JSON natively.
    ctx.onLoad({ filter: /css-tree\/lib\/(data-patch|data|version)\.js$/ }, async (args) => {
      let contents = readFileSync(args.path, "utf8");
      // Remove the createRequire setup
      contents = contents.replace(
        /import\s*\{\s*createRequire\s*\}\s*from\s*['"]module['"];?\s*/g,
        "",
      );
      contents = contents.replace(
        /const\s+require\s*=\s*createRequire\(import\.meta\.url\);?\s*/g,
        "",
      );
      // Convert remaining ESM-style require() calls to static imports that
      // esbuild can resolve. We read the JSON files and inline them.
      contents = contents.replace(
        /require\(['"]([^'"]+\.json)['"]\)/g,
        (match, jsonPath) => {
          const resolved = resolve(dirname(args.path), jsonPath);
          try {
            const json = readFileSync(resolved, "utf8");
            return json.trim();
          } catch {
            // If resolution fails, try from node_modules
            try {
              const json = readFileSync(
                resolve("node_modules", jsonPath),
                "utf8",
              );
              return json.trim();
            } catch {
              return match; // keep original if both fail
            }
          }
        },
      );
      return { contents, loader: "js" };
    });
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
  // Polyfill import.meta.url for any remaining ESM libs
  banner: {
    js: 'var importMetaUrl = require("url").pathToFileURL(__filename).href;',
  },
};

// Bundle data-collector (includes jsdom)
await build({
  ...shared,
  entryPoints: ["src/lambdas/data-collector.mjs"],
  outfile: "dist/data-collector/index.js",
  plugins: [fixRuntimeReads],
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
