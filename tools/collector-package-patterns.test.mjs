import { beforeAll, describe, expect, it, vi } from "vitest";
import path from "node:path";
import { tmpdir } from "node:os";

// test-setup.mjs globally mocks `fs`; this module reads the real filesystem,
// so unmock it and import everything fresh (mirrors taste-parser.test.mjs).
let jsdomClosure, computeCollectorPatterns, existsSync, mkdtempSync, readFileSync;
let patterns;

const NODE_MODULES = path.join(process.cwd(), "node_modules");

beforeAll(async () => {
  vi.doUnmock("fs");
  vi.doUnmock("node:fs");
  ({ existsSync, mkdtempSync, readFileSync } = await import("node:fs"));
  ({ jsdomClosure, computeCollectorPatterns } = await import(
    "./collector-package-patterns.mjs"
  ));
  patterns = computeCollectorPatterns(NODE_MODULES);
});

describe("collector package patterns", () => {
  it("includes the static lead entries", () => {
    expect(patterns.slice(0, 6)).toEqual([
      "!**",
      "dist/data-collector/**",
      "node_modules/jsdom/**",
      "node_modules/pdfjs-dist/legacy/build/pdf.mjs",
      "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      "node_modules/pdfjs-dist/package.json",
    ]);
  });

  it("includes jsdom's critical transitive deps", () => {
    for (const pkg of [
      "xmlchars",
      "@bramus/specificity",
      "parse5",
      "tough-cookie",
      "@exodus/bytes",
      "undici",
    ]) {
      expect(patterns).toContain(`node_modules/${pkg}/**`);
    }
  });

  it("does not ship the optional native @napi-rs/canvas", () => {
    expect(patterns.some((p) => p.includes("@napi-rs"))).toBe(false);
  });

  it("keeps the pdfjs/tldts/metadata excludes", () => {
    expect(patterns).toContain("!node_modules/pdfjs-dist/cmaps/**");
    expect(patterns).toContain("!node_modules/tldts/dist/es6/**");
    expect(patterns).toContain("!**/*.md");
  });

  it("only references node_modules packages that exist on disk", () => {
    const missing = patterns
      .filter((p) => p.startsWith("node_modules/")) // include rules only
      .map((p) => {
        const segs = p.split("/");
        const depth = p.startsWith("node_modules/@") ? 3 : 2;
        return segs.slice(0, depth).join("/");
      })
      .filter((pkgPath) => !existsSync(path.join(process.cwd(), pkgPath)));
    expect([...new Set(missing)]).toEqual([]);
  });

  it("throws when a required package is missing (fail-fast guard)", () => {
    const empty = mkdtempSync(path.join(tmpdir(), "no-jsdom-"));
    expect(() => jsdomClosure(empty)).toThrow(/required package "jsdom"/);
  });

  // Serverless concatenates the SERVICE-level `package.patterns` ahead of each
  // function's own list and keeps the FIRST occurrence of a duplicated pattern.
  // serverless.yml used to repeat these same metadata excludes at the service
  // level, which hoisted them in front of the include rules — so the includes
  // re-added the very files the excludes were meant to strip, and the Lambda
  // shipped 90 sourcemaps / 60 READMEs / 190 .ts sources for 1.23 MB of dead
  // weight. That left 0.26 MB of headroom and is what blocked jsdom 30.
  // Measured on osls 4.0.0 (2 reps per cell, zip read with python zipfile):
  //   service `!**/x` + function `!**/x`  -> 4,970,896 B, 90 maps  (duplicated)
  //   service absent  + function `!**/x`  -> 3,660,164 B,  0 maps  (fixed)
  // Keep the excludes in exactly one place: this file.
  it("serverless.yml declares no service-level package.patterns", () => {
    const yml = readFileSync(
      path.join(process.cwd(), "serverless.yml"),
      "utf8",
    );
    const lines = yml.split("\n");
    const start = lines.findIndex((l) => l === "package:");
    expect(start).toBeGreaterThan(-1);

    const block = [];
    for (const line of lines.slice(start + 1)) {
      if (line.trim() !== "" && !/^\s/.test(line)) break; // next top-level key
      block.push(line);
    }
    const declaresPatterns = block.some((l) => /^\s+patterns:/.test(l));
    expect(declaresPatterns).toBe(false);
  });
});
