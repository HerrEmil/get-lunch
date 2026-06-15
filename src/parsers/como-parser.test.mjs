import { beforeAll, describe, expect, it, beforeEach, vi } from "vitest";
import { ComoParser } from "./como-parser.mjs";

function createParser() {
  const parser = new ComoParser();
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

// Matches the real site structure (homepage menu overlay): a <section> wraps the
// H2 heading and a UL; each LI nests the category <h3> + description <p> in a div,
// with the price in a separate trailing <p>.
const SAMPLE_HTML = `
<html><body>
  <div id="menu-content">
    <section>
      <h2>Lunchmeny V.14 (11:30–14:00, M–F)</h2>
      <ul>
        <li>
          <div class="flex-1"><h3>Kött</h3>
            <p>grillad kalv tri tip, tomatsallad, pommes frites &amp; bearnaisesås</p>
          </div>
          <p>185</p>
        </li>
        <li>
          <div class="flex-1"><h3>fisk</h3>
            <p>sydfransk fiskgryta, vitt vin, handskalade räkor &amp; saffransrouille</p>
          </div>
          <p>195</p>
        </li>
        <li>
          <div class="flex-1"><h3>veg</h3>
            <p>romesco, grillade vårgrönsaker, marconamandlar &amp; parmesan</p>
          </div>
          <p>165</p>
        </li>
        <li>
          <div class="flex-1"><h3>sallad</h3>
            <p>varmrökt lax, färskpotatis, sparris &amp; dillmajonnäs</p>
          </div>
          <p>195</p>
        </li>
        <li>
          <div class="flex-1"><h3>Dagens Tarte</h3></div>
          <p>85</p>
        </li>
        <li>
          <div class="flex-1"><h3>chokladtryffel</h3></div>
          <p>35</p>
        </li>
      </ul>
    </section>
    <section>
      <h2>meny kväll</h2>
      <ul>
        <li>
          <div class="flex-1"><h3>GRILLAT SURDEGSBRÖD</h3></div>
          <p>95</p>
        </li>
      </ul>
    </section>
  </div>
</body></html>
`;

describe("ComoParser", () => {
  let parser;

  beforeEach(() => {
    parser = createParser();
  });

  it("returns correct getName and getUrl", () => {
    expect(parser.getName()).toBe("COMO");
    expect(parser.getUrl()).toBe("https://comomalmo.se/");
  });

  it("extracts week number from V.XX pattern", () => {
    const dom = new JSDOM(`<html><body><h2>Lunchmeny V.14 (M–F)</h2></body></html>`);
    expect(parser.extractWeekNumber(dom.window.document)).toBe(14);
  });

  it("extracts week number from Vecka XX pattern", () => {
    const dom = new JSDOM(`<html><body><h2>Lunchmeny Vecka 7</h2></body></html>`);
    expect(parser.extractWeekNumber(dom.window.document)).toBe(7);
  });

  it("extracts dishes with categories and prices", () => {
    const dom = new JSDOM(SAMPLE_HTML);
    const dishes = parser.extractDishes(dom.window.document);

    // Only the 4 lunch categories, not desserts
    expect(dishes).toHaveLength(4);

    expect(dishes[0]).toMatchObject({ name: "Kött", price: 185 });
    expect(dishes[0].description).toContain("kalv tri tip");

    expect(dishes[1]).toMatchObject({ name: "Fisk", price: 195 });
    expect(dishes[1].description).toContain("fiskgryta");

    expect(dishes[2]).toMatchObject({ name: "Veg", price: 165 });
    expect(dishes[2].description).toContain("romesco");

    expect(dishes[3]).toMatchObject({ name: "Sallad", price: 195 });
    expect(dishes[3].description).toContain("lax");
  });

  it("creates 5 lunches per dish (one per weekday)", async () => {
    const dom = new JSDOM(SAMPLE_HTML);
    parser.fetchDocument = async () => dom.window.document;

    const lunches = await parser.parseMenu();

    // 4 dishes * 5 weekdays = 20 lunches
    expect(lunches).toHaveLength(20);

    const weekdays = lunches.slice(0, 5).map((l) => l.weekday);
    expect(weekdays).toEqual(["måndag", "tisdag", "onsdag", "torsdag", "fredag"]);

    for (const lunch of lunches) {
      expect(lunch.week).toBe(14);
      expect(lunch.place).toBe("COMO");
    }
  });

  it("returns empty array when no Lunchmeny heading found", () => {
    const dom = new JSDOM(`<html><body><h2>Middagsmeny</h2><ul><li><h3>Kött</h3> pasta 200</li></ul></body></html>`);
    const dishes = parser.extractDishes(dom.window.document);
    expect(dishes).toHaveLength(0);
  });

  it("skips non-lunch categories like desserts", () => {
    const dom = new JSDOM(SAMPLE_HTML);
    const dishes = parser.extractDishes(dom.window.document);
    const names = dishes.map((d) => d.name.toLowerCase());
    expect(names).not.toContain("dagens tarte");
    expect(names).not.toContain("chokladtryffel");
  });
});
