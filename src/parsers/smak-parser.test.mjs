import { beforeAll, describe, expect, it, beforeEach, vi } from "vitest";
import { SmakParser } from "./smak-parser.mjs";

function createParser() {
  const parser = new SmakParser();
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

// Captured from https://smak.gastrogate.com/lunch/ (2026-07, ISO week 29). The
// Gastrogate platform renders the week as a single `table.lunch_menu` made of
// day blocks: a `thead.lunch-day-header` (weekday + date in an <h3>) followed
// by a `tbody.lunch-day-content` of `tr.lunch-menu-item` rows, each with the
// dish in `td.td_title` and the price in `td.td_price .price-tag`. The first
// block ("Lunch på SMAK") is an included-items note with an empty price and no
// weekday — the parser skips it.
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
    <thead class="lunch-day-header"><tr><th class="menu_header" colspan="3"><h3>Lunch på SMAK</h3></th></tr></thead>
    <tbody class="lunch-day-content">
      <tr class="lunch-menu-item">
        <td class="td_title">Till dagens lunch ingår sallad, vatten, kaffe och vårt eget surdegsbröd varje dag.</td>
        <td class="td_dbsk hidden-xs"><div class="incl-wrapper"></div></td>
        <td class="td_price"><div class="price-container"><div class="price"></div></div></td>
      </tr>
    </tbody>

    <thead class="lunch-day-header"><tr><th class="menu_header" colspan="3"><h3>Måndag 13 juli</h3></th></tr></thead>
    <tbody class="lunch-day-content">
      <tr class="lunch-menu-item">
        <td class="td_title">Kalkonbröst med kålrabbi, äpple, hasselnötter, smörad buljong med dragon och gräslök.</td>
        <td class="td_dbsk hidden-xs"><div class="incl-wrapper"></div></td>
        <td class="td_price"><div class="price-container"><div class="price"><div class="price-alt"><strong class="price-tag">159 kr</strong></div></div></div></td>
      </tr>
      <tr class="lunch-menu-item">
        <td class="td_title">Kummel med gurka, silverlök och rädisor med citroncremé och dill</td>
        <td class="td_dbsk hidden-xs"><div class="incl-wrapper"></div></td>
        <td class="td_price"><div class="price-container"><div class="price"><div class="price-alt"><strong class="price-tag">169 kr</strong></div></div></div></td>
      </tr>
      <tr class="lunch-menu-item">
        <td class="td_title">Bakad blomkål med harrissaolja, bulgur, yoghurt, fetaost, saltrostad mandel och persilja</td>
        <td class="td_dbsk hidden-xs"><div class="incl-wrapper"></div></td>
        <td class="td_price"><div class="price-container"><div class="price"><div class="price-alt"><strong class="price-tag">149 kr</strong></div></div></div></td>
      </tr>
    </tbody>

    <thead class="lunch-day-header"><tr><th class="menu_header" colspan="3"><h3>Tisdag 14 juli</h3></th></tr></thead>
    <tbody class="lunch-day-content">
      <tr class="lunch-menu-item">
        <td class="td_title">Kalkonbröst med kålrabbi, äpple, hasselnötter, smörad buljong med dragon och gräslök.</td>
        <td class="td_dbsk hidden-xs"><div class="incl-wrapper"></div></td>
        <td class="td_price"><div class="price-container"><div class="price"><div class="price-alt"><strong class="price-tag">159 kr</strong></div></div></div></td>
      </tr>
      <tr class="lunch-menu-item">
        <td class="td_title">Kummel med gurka, silverlök och rädisor med citroncremé och dill</td>
        <td class="td_dbsk hidden-xs"><div class="incl-wrapper"></div></td>
        <td class="td_price"><div class="price-container"><div class="price"><div class="price-alt"><strong class="price-tag">169 kr</strong></div></div></div></td>
      </tr>
      <tr class="lunch-menu-item">
        <td class="td_title">Bakad blomkål med harrissaolja, bulgur, yoghurt, fetaost, saltrostad mandel och persilja</td>
        <td class="td_dbsk hidden-xs"><div class="incl-wrapper"></div></td>
        <td class="td_price"><div class="price-container"><div class="price"><div class="price-alt"><strong class="price-tag">149 kr</strong></div></div></div></td>
      </tr>
    </tbody>

    <thead class="lunch-day-header"><tr><th class="menu_header" colspan="3"><h3>Onsdag 15 juli</h3></th></tr></thead>
    <tbody class="lunch-day-content">
      <tr class="lunch-menu-item">
        <td class="td_title">Kalkonbröst med kålrabbi, äpple, hasselnötter, smörad buljong med dragon och gräslök.</td>
        <td class="td_dbsk hidden-xs"><div class="incl-wrapper"></div></td>
        <td class="td_price"><div class="price-container"><div class="price"><div class="price-alt"><strong class="price-tag">159 kr</strong></div></div></div></td>
      </tr>
      <tr class="lunch-menu-item">
        <td class="td_title">Lättgravad laxfile med citron &amp; vitvinssås, morot, fänkålscrudite, dillolja och vitlök &amp; citronpanko</td>
        <td class="td_dbsk hidden-xs"><div class="incl-wrapper"></div></td>
        <td class="td_price"><div class="price-container"><div class="price"><div class="price-alt"><strong class="price-tag">169 kr</strong></div></div></div></td>
      </tr>
      <tr class="lunch-menu-item">
        <td class="td_title">Hummus med ugnsbakade rödbetor, torkade oliver, mozzarella, valnötter, persilja och mynta</td>
        <td class="td_dbsk hidden-xs"><div class="incl-wrapper"></div></td>
        <td class="td_price"><div class="price-container"><div class="price"><div class="price-alt"><strong class="price-tag">149 kr</strong></div></div></div></td>
      </tr>
    </tbody>

    <thead class="lunch-day-header"><tr><th class="menu_header" colspan="3"><h3>Torsdag 16 juli</h3></th></tr></thead>
    <tbody class="lunch-day-content">
      <tr class="lunch-menu-item">
        <td class="td_title">Wallenbergare med potatismos, ärtor, lingon, skirat smör och ärtskott</td>
        <td class="td_dbsk hidden-xs"><div class="incl-wrapper"></div></td>
        <td class="td_price"><div class="price-container"><div class="price"><div class="price-alt"><strong class="price-tag">159 kr</strong></div></div></div></td>
      </tr>
      <tr class="lunch-menu-item">
        <td class="td_title">Lättgravad laxfile med citron &amp; vitvinssås, morot, fänkålscrudite, dillolja och vitlök &amp; citronpanko</td>
        <td class="td_dbsk hidden-xs"><div class="incl-wrapper"></div></td>
        <td class="td_price"><div class="price-container"><div class="price"><div class="price-alt"><strong class="price-tag">169 kr</strong></div></div></div></td>
      </tr>
      <tr class="lunch-menu-item">
        <td class="td_title">Hummus med ugnsbakade rödbetor, torkade oliver, mozzarella, valnötter, persilja och mynta</td>
        <td class="td_dbsk hidden-xs"><div class="incl-wrapper"></div></td>
        <td class="td_price"><div class="price-container"><div class="price"><div class="price-alt"><strong class="price-tag">149 kr</strong></div></div></div></td>
      </tr>
    </tbody>

    <thead class="lunch-day-header"><tr><th class="menu_header" colspan="3"><h3>Fredag 17 juli</h3></th></tr></thead>
    <tbody class="lunch-day-content">
      <tr class="lunch-menu-item">
        <td class="td_title">Wallenbergare med potatismos, ärtor, lingon, skirat smör och ärtskott</td>
        <td class="td_dbsk hidden-xs"><div class="incl-wrapper"></div></td>
        <td class="td_price"><div class="price-container"><div class="price"><div class="price-alt"><strong class="price-tag">159 kr</strong></div></div></div></td>
      </tr>
      <tr class="lunch-menu-item">
        <td class="td_title">Lättgravad laxfile med citron &amp; vitvinssås, morot, fänkålscrudite, dillolja och vitlök &amp; citronpanko</td>
        <td class="td_dbsk hidden-xs"><div class="incl-wrapper"></div></td>
        <td class="td_price"><div class="price-container"><div class="price"><div class="price-alt"><strong class="price-tag">169 kr</strong></div></div></div></td>
      </tr>
      <tr class="lunch-menu-item">
        <td class="td_title">Hummus med ugnsbakade rödbetor, torkade oliver, mozzarella, valnötter, persilja och mynta</td>
        <td class="td_dbsk hidden-xs"><div class="incl-wrapper"></div></td>
        <td class="td_price"><div class="price-container"><div class="price"><div class="price-alt"><strong class="price-tag">149 kr</strong></div></div></div></td>
      </tr>
    </tbody>
  </table>
</body></html>
`;

// A "whole week" day header (some Gastrogate menus publish one block that
// applies to the entire week) fans out across Mon–Fri.
const MOCK_WHOLE_WEEK = `
<html><body>
  <div class="btn-group menu-nav">
    <a class="btn btn-info dropdown-toggle" data-toggle="dropdown" href="#">Vecka 30<span class="caret"></span></a>
  </div>
  <table class="table lunch_menu animation">
    <thead class="lunch-day-header"><tr><th class="menu_header" colspan="3"><h3>Gäller hela vecka 30</h3></th></tr></thead>
    <tbody class="lunch-day-content">
      <tr class="lunch-menu-item">
        <td class="td_title">Pasta med köttfärssås</td>
        <td class="td_price"><strong class="price-tag">130 kr</strong></td>
      </tr>
      <tr class="lunch-menu-item">
        <td class="td_title">Vegetarisk lasagne</td>
        <td class="td_price"><strong class="price-tag">125 kr</strong></td>
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

describe("SmakParser", () => {
  let parser;

  beforeEach(() => {
    parser = createParser();
  });

  it("returns correct name and url", () => {
    expect(parser.getName()).toBe("SMAK");
    expect(parser.getUrl()).toBe("https://smak.gastrogate.com/lunch/");
  });

  it("extracts the active week from the week selector", () => {
    const dom = new JSDOM(MOCK_HTML);
    expect(parser.extractWeekNumber(dom.window.document)).toBe(29);
  });

  it("maps day headers to weekdays and whole-week blocks", () => {
    expect(parser.headerToWeekdays("Måndag 13 juli")).toEqual(["måndag"]);
    expect(parser.headerToWeekdays("Fredag 17 juli")).toEqual(["fredag"]);
    expect(parser.headerToWeekdays("Lunch på SMAK")).toEqual([]);
    expect(parser.headerToWeekdays("Gäller hela vecka 30")).toEqual([
      "måndag",
      "tisdag",
      "onsdag",
      "torsdag",
      "fredag",
    ]);
  });

  it("parses the full week into 15 lunches, skipping the intro note", async () => {
    const dom = new JSDOM(MOCK_HTML);
    parser.fetchDocument = async () => dom.window.document;

    const lunches = await parser.parseMenu();

    expect(lunches).toHaveLength(15);

    const weeks = new Set(lunches.map((l) => l.week));
    expect(weeks).toEqual(new Set([29]));

    const weekdays = new Set(lunches.map((l) => l.weekday));
    expect(weekdays).toEqual(
      new Set(["måndag", "tisdag", "onsdag", "torsdag", "fredag"]),
    );

    // Three dishes per weekday.
    expect(lunches.filter((l) => l.weekday === "måndag")).toHaveLength(3);

    expect(lunches[0]).toMatchObject({
      name: "Kalkonbröst med kålrabbi, äpple, hasselnötter, smörad buljong med dragon och gräslök.",
      price: 159,
      weekday: "måndag",
      place: "SMAK",
    });

    // The included-items intro must not leak in as a dish.
    expect(lunches.some((l) => /ingår sallad/i.test(l.name))).toBe(false);

    // HTML entities in the title are decoded by the DOM.
    const lax = lunches.find((l) => l.name.startsWith("Lättgravad laxfile"));
    expect(lax.name).toContain("citron & vitvinssås");
    expect(lax.name).toContain("vitlök & citronpanko");
    expect(lax.price).toBe(169);
  });

  it("fans a whole-week block out across Mon–Fri", async () => {
    const dom = new JSDOM(MOCK_WHOLE_WEEK);
    parser.fetchDocument = async () => dom.window.document;

    const lunches = await parser.parseMenu();

    // 2 dishes × 5 weekdays.
    expect(lunches).toHaveLength(10);
    expect(new Set(lunches.map((l) => l.week))).toEqual(new Set([30]));
    expect(lunches.filter((l) => l.name === "Pasta med köttfärssås")).toHaveLength(5);
  });

  it("returns no lunches when the menu table is missing", async () => {
    const dom = new JSDOM(`<html><body><p>Ingen meny</p></body></html>`);
    parser.fetchDocument = async () => dom.window.document;

    const lunches = await parser.parseMenu();
    expect(lunches).toEqual([]);
  });
});
