import { beforeAll, describe, expect, it, beforeEach, vi } from "vitest";
import { HolyGreensParser } from "./holygreens-parser.mjs";

function createParser() {
  const parser = new HolyGreensParser();
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

describe("HolyGreensParser", () => {
  let parser;

  beforeEach(() => {
    parser = createParser();
  });

  it("returns correct name and url", () => {
    expect(parser.getName()).toBe("Holy Greens");
    expect(parser.getUrl()).toBe("https://holygreens.se/meny/");
  });

  it("extracts item names from .item elements", () => {
    const dom = new JSDOM(`
      <html><body>
        <div class="item"><h3>Caesar Salad</h3><p>Romansallad, parmesan, krutonger</p></div>
        <div class="item"><h3>Thai Bowl</h3><p>Ris, kyckling, jordnötter</p></div>
        <div class="item"><h3>Greek Salad</h3><p>Fetaost, oliver, tomat</p></div>
      </body></html>
    `);
    const names = parser.extractItemNames(dom.window.document);
    expect(names).toEqual(["Caesar Salad", "Thai Bowl", "Greek Salad"]);
  });

  it("returns empty array when no .item elements found", () => {
    const dom = new JSDOM(`<html><body><p>Nothing here</p></body></html>`);
    const names = parser.extractItemNames(dom.window.document);
    expect(names).toEqual([]);
  });

  it("creates one lunch per weekday with item names as description", async () => {
    const dom = new JSDOM(`
      <html><body>
        <div class="item"><h3>Caesar Salad</h3><p>Romansallad</p></div>
        <div class="item"><h3>Thai Bowl</h3><p>Ris, kyckling</p></div>
        <div class="item"><h3>Greek Salad</h3><p>Fetaost, oliver</p></div>
        <div class="item"><h3>Poke Bowl</h3><p>Lax, ris</p></div>
        <div class="item"><h3>Falafel Bowl</h3><p>Falafel, hummus</p></div>
        <div class="item"><h3>Smoothie</h3><p>Banan, blåbär</p></div>
      </body></html>
    `);

    parser.fetchDocument = async () => dom.window.document;

    const lunches = await parser.parseMenu();

    expect(lunches).toHaveLength(5);
    expect(lunches[0]).toMatchObject({
      name: "Sallader & Hot Bowls",
      price: 0,
      weekday: "måndag",
      place: "Holy Greens",
    });
    // Description should contain first 5 items
    expect(lunches[0].description).toContain("Caesar Salad");
    expect(lunches[0].description).toContain("Falafel Bowl");
    // 6th item should not be in description
    expect(lunches[0].description).not.toContain("Smoothie");

    expect(lunches[4]).toMatchObject({
      weekday: "fredag",
    });

    const weeks = new Set(lunches.map((l) => l.week));
    expect(weeks.size).toBe(1);
  });

  it("handles empty menu page", async () => {
    const dom = new JSDOM(`<html><body><p>Coming soon</p></body></html>`);

    parser.fetchDocument = async () => dom.window.document;

    const lunches = await parser.parseMenu();

    expect(lunches).toHaveLength(5);
    expect(lunches[0].description).toBe("");
  });
});
