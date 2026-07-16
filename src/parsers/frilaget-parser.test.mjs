import { beforeAll, describe, expect, it, beforeEach, vi } from "vitest";
import { FrilagetParser } from "./frilaget-parser.mjs";

function createParser() {
  const parser = new FrilagetParser();
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

// Captured verbatim from https://frilaget.gastrogate.com/lunch/ (2026-07-16,
// ISO week 29). The Gastrogate platform renders the week as a single
// `table.lunch_menu` made of day blocks: a `thead.lunch-day-header` (an <h3>
// holding a weekday + date, a "Vardagsmeny" everyday block, or a "Gäller hela
// vecka NN" whole-week block) followed by a `tbody.lunch-day-content` of
// `tr.lunch-menu-item` rows, each with the dish in `td.td_title` and the price
// in `td.td_price .price-tag`. Friläget's current-week menu pairs two single
// weekday blocks (Torsdag, Fredag) with a "Vardagsmeny" everyday dish and a
// "Gäller hela vecka 29" block of two weekly alternatives.
const MOCK_HTML = `
<html><body>
  <div class="btn-group menu-nav">
    <a class="btn btn-info dropdown-toggle" data-toggle="dropdown" href="#">Vecka 29<span class="caret"></span></a>
    <ul class="dropdown-menu">
      <li class="active"><a href="/lunch/">Vecka 29</a></li>
      <li class=""><a href="/lunch/1/">Vecka 30</a></li>
    </ul>
  </div>
  <div class="above_info">Dryck, bröd, sallad och kaffe ingår</div>
  <table class="table lunch_menu animation">
    <thead class="lunch-day-header"><tr><th class="menu_header" colspan="3"><h3>Torsdag 16 juli</h3></th></tr></thead>
    <tbody class="lunch-day-content">
      <tr class="lunch-menu-item">
        <td class="td_title">Fläskfilé Oscar med sparris,räkor och bearnaisesås</td>
        <td class="td_dbsk hidden-xs"><div class="incl-wrapper"></div></td>
        <td class="td_price"><div class="price-container"><div class="price"><div class="price-alt"><strong class="price-tag">120 kr</strong></div></div></div></td>
      </tr>
    </tbody>

    <thead class="lunch-day-header"><tr><th class="menu_header" colspan="3"><h3>Fredag 17 juli</h3></th></tr></thead>
    <tbody class="lunch-day-content">
      <tr class="lunch-menu-item">
        <td class="td_title">Hängmörad ryggbiff med Rödvinssås</td>
        <td class="td_dbsk hidden-xs"><div class="incl-wrapper"></div></td>
        <td class="td_price"><div class="price-container"><div class="price"><div class="price-alt"><strong class="price-tag">120 kr</strong></div></div></div></td>
      </tr>
    </tbody>

    <thead class="lunch-day-header"><tr><th class="menu_header" colspan="3"><h3>Vardagsmeny</h3></th></tr></thead>
    <tbody class="lunch-day-content">
      <tr class="lunch-menu-item">
        <td class="td_title">Veckans pasta: Spaghetti bolognaise alt Carbonara</td>
        <td class="td_dbsk hidden-xs"><div class="incl-wrapper"></div></td>
        <td class="td_price"><div class="price-container"><div class="price"><div class="price-alt"><strong class="price-tag">115 kr</strong></div></div></div></td>
      </tr>
    </tbody>

    <thead class="lunch-day-header"><tr><th class="menu_header" colspan="3"><h3>Gäller hela vecka 29</h3></th></tr></thead>
    <tbody class="lunch-day-content">
      <tr class="lunch-menu-item">
        <td class="td_title">Veckans alternativ: Gravlax med dillstuvad potatis</td>
        <td class="td_dbsk hidden-xs"><div class="incl-wrapper"></div></td>
        <td class="td_price"><div class="price-container"><div class="price"><div class="price-alt"><strong class="price-tag">120 kr</strong></div></div></div></td>
      </tr>
      <tr class="lunch-menu-item">
        <td class="td_title">Veckans vegetariska: Veggikorv med dillstuvad potatis</td>
        <td class="td_dbsk hidden-xs"><div class="incl-wrapper"></div></td>
        <td class="td_price"><div class="price-container"><div class="price"><div class="price-alt"><strong class="price-tag">120 kr</strong></div></div></div></td>
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

describe("FrilagetParser", () => {
  let parser;

  beforeEach(() => {
    parser = createParser();
  });

  it("returns correct name and url", () => {
    expect(parser.getName()).toBe("Friläget");
    expect(parser.getUrl()).toBe("https://frilaget.gastrogate.com/lunch/");
  });

  it("extracts the active week from the week selector", () => {
    const dom = new JSDOM(MOCK_HTML);
    expect(parser.extractWeekNumber(dom.window.document)).toBe(29);
  });

  it("maps day headers to weekdays and whole-week blocks", () => {
    expect(parser.headerToWeekdays("Torsdag 16 juli")).toEqual(["torsdag"]);
    expect(parser.headerToWeekdays("Fredag 17 juli")).toEqual(["fredag"]);
    expect(parser.headerToWeekdays("Vardagsmeny")).toEqual([
      "måndag",
      "tisdag",
      "onsdag",
      "torsdag",
      "fredag",
    ]);
    expect(parser.headerToWeekdays("Gäller hela vecka 29")).toEqual([
      "måndag",
      "tisdag",
      "onsdag",
      "torsdag",
      "fredag",
    ]);
    expect(parser.headerToWeekdays("Lunch på Friläget")).toEqual([]);
  });

  it("parses weekday blocks plus the everyday and whole-week blocks", async () => {
    const dom = new JSDOM(MOCK_HTML);
    parser.fetchDocument = async () => dom.window.document;

    const lunches = await parser.parseMenu();

    // 1 Thursday + 1 Friday day-block dish, plus (1 Vardagsmeny + 2 whole-week
    // dishes) × 5 weekdays = 2 + 15 = 17.
    expect(lunches).toHaveLength(17);

    expect(new Set(lunches.map((l) => l.week))).toEqual(new Set([29]));
    expect(new Set(lunches.map((l) => l.place))).toEqual(new Set(["Friläget"]));

    // The three week-wide dishes land on every weekday; Thursday and Friday
    // each carry one extra day-block dish.
    expect(lunches.filter((l) => l.weekday === "måndag")).toHaveLength(3);
    expect(lunches.filter((l) => l.weekday === "torsdag")).toHaveLength(4);
    expect(lunches.filter((l) => l.weekday === "fredag")).toHaveLength(4);

    // The Thursday-only main is present exactly once.
    expect(
      lunches.filter((l) => /Fläskfilé Oscar/.test(l.name)),
    ).toHaveLength(1);

    // The Vardagsmeny pasta fans across all five weekdays.
    const pasta = lunches.filter((l) => l.name.startsWith("Veckans pasta"));
    expect(pasta).toHaveLength(5);
    expect(pasta[0].price).toBe(115);

    // A whole-week alternative also fans across all five weekdays.
    expect(
      lunches.filter((l) => l.name.startsWith("Veckans vegetariska")),
    ).toHaveLength(5);
  });

  it("returns no lunches when the menu table is missing", async () => {
    const dom = new JSDOM(`<html><body><p>Ingen meny</p></body></html>`);
    parser.fetchDocument = async () => dom.window.document;

    const lunches = await parser.parseMenu();
    expect(lunches).toEqual([]);
  });
});
