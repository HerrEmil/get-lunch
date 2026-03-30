import { beforeAll, describe, expect, it, beforeEach, vi } from "vitest";
import { LazizaParser } from "./laziza-parser.mjs";

function createParser() {
  const parser = new LazizaParser();
  parser.logger = {
    info: () => Promise.resolve(),
    warn: () => Promise.resolve(),
    error: () => Promise.resolve(),
    debug: () => Promise.resolve(),
    startTimer: () => {},
    endTimer: () => {},
  };
  return parser;
}

let JSDOM;

beforeAll(async () => {
  vi.doUnmock("jsdom");
  ({ JSDOM } = await import("jsdom"));
});

describe("LazizaParser", () => {
  let parser;

  beforeEach(() => {
    parser = createParser();
  });

  it("returns correct name and url", () => {
    expect(parser.getName()).toBe("Laziza");
    expect(parser.getUrl()).toBe("https://www.laziza.se/lunch/");
  });

  it("extracts price from page text", () => {
    const dom = new JSDOM(`
      <html><body>
        <h1>Lunch</h1>
        <p>Libanesisk lunchbuffé, måndag till fredag 11:00 — 15:00</p>
        <p>139 kr / 115 kr (take away)</p>
      </body></html>
    `);
    const price = parser.extractPriceFromPage(dom.window.document);
    expect(price).toBe(139);
  });

  it("extracts description from page text", () => {
    const dom = new JSDOM(`
      <html><body>
        <h1>Lunch</h1>
        <p>Libanesisk lunchbuffé, måndag till fredag 11:00 — 15:00</p>
        <p>139 kr / 115 kr (take away)</p>
      </body></html>
    `);
    const description = parser.extractDescriptionFromPage(dom.window.document);
    expect(description).toContain("måndag");
    expect(description).toMatch(/11:00/);
  });

  it("returns default description when pattern not found", () => {
    const dom = new JSDOM(`
      <html><body>
        <h1>Lunch</h1>
        <p>Välkommen!</p>
      </body></html>
    `);
    const description = parser.extractDescriptionFromPage(dom.window.document);
    expect(description).toBe("Måndag till fredag 11:00-15:00");
  });

  it("creates one lunch per weekday", async () => {
    const dom = new JSDOM(`
      <html><body>
        <h1>Lunch</h1>
        <p>Libanesisk lunchbuffé, måndag till fredag 11:00 — 15:00</p>
        <p>139 kr / 115 kr (take away)</p>
      </body></html>
    `);

    // Mock fetchDocument to return our fixture
    parser.fetchDocument = async () => dom.window.document;

    const lunches = await parser.parseMenu();

    expect(lunches).toHaveLength(5);
    expect(lunches[0]).toMatchObject({
      name: "Libanesisk lunchbuffé",
      price: 139,
      weekday: "måndag",
      place: "Laziza",
    });
    expect(lunches[4]).toMatchObject({
      weekday: "fredag",
    });

    // All should have the same week
    const weeks = new Set(lunches.map((l) => l.week));
    expect(weeks.size).toBe(1);
  });

  it("returns price 0 when no price found", () => {
    const dom = new JSDOM(`<html><body><p>No price here</p></body></html>`);
    expect(parser.extractPriceFromPage(dom.window.document)).toBe(0);
  });
});
