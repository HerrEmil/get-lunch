import { beforeAll, describe, expect, it, beforeEach, vi } from "vitest";
import { KolgaParser } from "./kolga-parser.mjs";

function createParser() {
  const parser = new KolgaParser();
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

// Captured from https://kolga.gastrogate.com/lunch/ (2026-07, ISO week 29). The
// Gastrogate platform renders the week as a single `table.lunch_menu` made of
// day blocks: a `thead.lunch-day-header` (an <h3> holding either a weekday +
// date or a "Gäller hela vecka NN" whole-week label) followed by a
// `tbody.lunch-day-content` of `tr.lunch-menu-item` rows, each with the dish in
// `td.td_title` and the price in `td.td_price .price-tag`. Kolga's current-week
// menu pairs a single "Torsdag" day block with a whole-week block; one dish
// title carries a `<br>` that must be collapsed to a single space.
const MOCK_HTML = `
<html><body>
  <div class="btn-group menu-nav">
    <a class="btn btn-info dropdown-toggle" data-toggle="dropdown" href="#">Vecka 29<span class="caret"></span></a>
    <ul class="dropdown-menu">
      <li class="active"><a href="/lunch/">Vecka 29</a></li>
      <li class=""><a href="/lunch/1/">Vecka 30</a></li>
    </ul>
  </div>
  <table class="table lunch_menu animation">
    <thead class="lunch-day-header"><tr><th class="menu_header" colspan="3"><h3>Torsdag 16 juli</h3></th></tr></thead>
    <tbody class="lunch-day-content">
      <tr class="lunch-menu-item">
        <td class="td_title">Ärtsoppa eller Fisksoppa, pannkakor med sylt och grädde</td>
        <td class="td_dbsk hidden-xs"><div class="incl-wrapper"></div></td>
        <td class="td_price"><div class="price-container"><div class="price"><div class="price-alt"><strong class="price-tag">130 kr</strong></div></div></div></td>
      </tr>
    </tbody>

    <thead class="lunch-day-header"><tr><th class="menu_header" colspan="3"><h3>Gäller hela vecka 29</h3></th></tr></thead>
    <tbody class="lunch-day-content">
      <tr class="lunch-menu-item">
        <td class="td_title">Hamburger tallrik med <br />
pommes frites</td>
        <td class="td_dbsk hidden-xs"><div class="incl-wrapper"></div></td>
        <td class="td_price"><div class="price-container"><div class="price"><div class="price-alt"><strong class="price-tag">130 kr</strong></div></div></div></td>
      </tr>
      <tr class="lunch-menu-item">
        <td class="td_title">Pasta med köttfärssås</td>
        <td class="td_dbsk hidden-xs"><div class="incl-wrapper"></div></td>
        <td class="td_price"><div class="price-container"><div class="price"><div class="price-alt"><strong class="price-tag">130 kr</strong></div></div></div></td>
      </tr>
      <tr class="lunch-menu-item">
        <td class="td_title">Endast Salladsbuffé</td>
        <td class="td_dbsk hidden-xs"><div class="incl-wrapper"></div></td>
        <td class="td_price"><div class="price-container"><div class="price"><div class="price-alt"><strong class="price-tag">105 kr</strong></div></div></div></td>
      </tr>
    </tbody>
  </table>
</body></html>
`;

let JSDOM;

beforeAll(async () => {
  vi.doUnmock("jsdom");
  ({ JSDOM } = await import("jsdom"));
});

describe("KolgaParser", () => {
  let parser;

  beforeEach(() => {
    parser = createParser();
  });

  it("returns correct name and url", () => {
    expect(parser.getName()).toBe("Kolga");
    expect(parser.getUrl()).toBe("https://kolga.gastrogate.com/lunch/");
  });

  it("extracts the active week from the week selector", () => {
    const dom = new JSDOM(MOCK_HTML);
    expect(parser.extractWeekNumber(dom.window.document)).toBe(29);
  });

  it("maps day headers to weekdays and whole-week blocks", () => {
    expect(parser.headerToWeekdays("Torsdag 16 juli")).toEqual(["torsdag"]);
    expect(parser.headerToWeekdays("Gäller hela vecka 29")).toEqual([
      "måndag",
      "tisdag",
      "onsdag",
      "torsdag",
      "fredag",
    ]);
    expect(parser.headerToWeekdays("Lunch på Kolga")).toEqual([]);
  });

  it("parses the day block plus the whole-week block", async () => {
    const dom = new JSDOM(MOCK_HTML);
    parser.fetchDocument = async () => dom.window.document;

    const lunches = await parser.parseMenu();

    // 1 Thursday dish + (3 whole-week dishes × 5 weekdays) = 16.
    expect(lunches).toHaveLength(16);

    expect(new Set(lunches.map((l) => l.week))).toEqual(new Set([29]));
    expect(new Set(lunches.map((l) => l.place))).toEqual(new Set(["Kolga"]));

    // The whole-week dishes land on every weekday; Thursday also gets its own
    // day-block dish, so it carries one extra.
    expect(lunches.filter((l) => l.weekday === "måndag")).toHaveLength(3);
    expect(lunches.filter((l) => l.weekday === "torsdag")).toHaveLength(4);

    // The Thursday-only soup is present exactly once.
    expect(
      lunches.filter((l) => /Ärtsoppa eller Fisksoppa/.test(l.name)),
    ).toHaveLength(1);

    // A whole-week dish fans across all five weekdays.
    expect(
      lunches.filter((l) => l.name === "Pasta med köttfärssås"),
    ).toHaveLength(5);

    // The <br> inside the title collapses to a single space.
    const burger = lunches.find((l) => l.name.startsWith("Hamburger"));
    expect(burger.name).toBe("Hamburger tallrik med pommes frites");
    expect(burger.price).toBe(130);
  });

  it("returns no lunches when the menu table is missing", async () => {
    const dom = new JSDOM(`<html><body><p>Ingen meny</p></body></html>`);
    parser.fetchDocument = async () => dom.window.document;

    const lunches = await parser.parseMenu();
    expect(lunches).toEqual([]);
  });
});
