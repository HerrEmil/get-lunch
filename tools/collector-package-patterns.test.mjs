import { beforeAll, describe, expect, it, vi } from "vitest";
import path from "node:path";
import { tmpdir } from "node:os";

// test-setup.mjs globally mocks `fs`; this module reads the real filesystem,
// so unmock it and import everything fresh (mirrors taste-parser.test.mjs).
let jsdomClosure, computeCollectorPatterns, existsSync, mkdtempSync;
let patterns;

const NODE_MODULES = path.join(process.cwd(), "node_modules");

beforeAll(async () => {
  vi.doUnmock("fs");
  vi.doUnmock("node:fs");
  ({ existsSync, mkdtempSync } = await import("node:fs"));
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
});
