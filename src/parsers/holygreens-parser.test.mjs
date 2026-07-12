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

// Captured from https://holygreens.se/meny/ (2026-07, ISO week 29). Each dish is
// an `.item` card wrapping an `.image-wrap` image and a `.content-wrap` with the
// dish name in an <h3>, plus an optional `.more-wrap` nutrition block. The parser
// only reads the <h3> under each `.item`, so the surrounding wrappers mirror the
// live markup without the (large) nutrition tables.
const MOCK_HTML = `
<html><body>
  <div class="menu">
    <div class="item has-more">
      <div class="image-wrap"><img src="https://holygreens.se/wp-content/uploads/sommarsallad-app-640x480.jpg" width="640" height="480" alt=""></div>
      <div class="content-wrap"><h3>sommarsallad</h3><p class="p1">Bjärekyckling, vit quinoa, salladsmix, vattenmelon, jordgubbar.</p></div>
    </div>
    <div class="item has-more">
      <div class="image-wrap"><img src="https://holygreens.se/wp-content/uploads/asiatisk-raka-640x480.jpg" width="640" height="480" alt=""></div>
      <div class="content-wrap"><h3>asiatisk räka</h3><p class="p1">Räkor, ris, edamame, morot, sesam.</p></div>
    </div>
    <div class="item has-more">
      <div class="image-wrap"><img src="https://holygreens.se/wp-content/uploads/laxokado-1-640x480.jpg" width="640" height="480" alt=""></div>
      <div class="content-wrap"><h3>laxokado</h3><p class="p1">Varmrökt lax, avokado, quinoa, spenat.</p></div>
    </div>
    <div class="item has-more">
      <div class="image-wrap"><img src="https://holygreens.se/wp-content/uploads/holy-caesar-2-640x480.jpg" width="640" height="480" alt=""></div>
      <div class="content-wrap"><h3>holy caesar</h3><p class="p1">Kyckling, romansallad, parmesan, krutonger.</p></div>
    </div>
    <div class="item has-more">
      <div class="image-wrap"><img src="https://holygreens.se/wp-content/uploads/holylulu-640x480.jpg" width="640" height="480" alt=""></div>
      <div class="content-wrap"><h3>holylulu</h3><p class="p1">Falafel, hummus, granatäpple, quinoa.</p></div>
    </div>
    <div class="item has-more">
      <div class="image-wrap"><img src="https://holygreens.se/wp-content/uploads/gronsakslandet-640x480.jpg" width="640" height="480" alt=""></div>
      <div class="content-wrap"><h3>grönsakslandet vegansk</h3><p class="p1">Rostade grönsaker, linser, tahini.</p></div>
    </div>
  </div>
</body></html>
`;

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
    const dom = new JSDOM(MOCK_HTML);
    const names = parser.extractItemNames(dom.window.document);
    expect(names).toEqual([
      "sommarsallad",
      "asiatisk räka",
      "laxokado",
      "holy caesar",
      "holylulu",
      "grönsakslandet vegansk",
    ]);
  });

  it("returns empty array when no .item elements found", () => {
    const dom = new JSDOM(`<html><body><p>Nothing here</p></body></html>`);
    const names = parser.extractItemNames(dom.window.document);
    expect(names).toEqual([]);
  });

  it("creates one lunch per weekday with the first five item names as description", async () => {
    const dom = new JSDOM(MOCK_HTML);

    parser.fetchDocument = async () => dom.window.document;

    const lunches = await parser.parseMenu();

    expect(lunches).toHaveLength(5);
    expect(lunches[0]).toMatchObject({
      name: "Sallader & Hot Bowls",
      price: 0,
      weekday: "måndag",
      place: "Holy Greens",
    });
    // Description should contain the first 5 items...
    expect(lunches[0].description).toContain("sommarsallad");
    expect(lunches[0].description).toContain("holylulu");
    // ...but not the 6th.
    expect(lunches[0].description).not.toContain("grönsakslandet vegansk");

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
