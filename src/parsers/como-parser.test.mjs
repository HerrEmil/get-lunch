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

const SAMPLE_HTML = `
<html><body>
  <h2>Lunchmeny V.14 (M–F)</h2>
  <h3>Kött</h3>
  <p>Grillad entrecôte med bearnaisesås och pommes frites – 195 kr</p>
  <h3>Fisk</h3>
  <p>Stekt torsk med dillsås och kokt potatis – 185 kr</p>
  <h3>Veg</h3>
  <p>Halloumiburgare med sötpotatispommes och aioli – 175 kr</p>
  <h3>Sallad</h3>
  <p>Caesarsallad med kyckling och parmesan – 165 kr</p>
</body></html>
`;

describe("ComoParser", () => {
  let parser;

  beforeEach(() => {
    parser = createParser();
  });

  it("returns correct getName and getUrl", () => {
    expect(parser.getName()).toBe("COMO");
    expect(parser.getUrl()).toBe("https://comomalmo.se/meny");
  });

  it("extracts week number from V.XX pattern", () => {
    const dom = new JSDOM(`
      <html><body>
        <h2>Lunchmeny V.14 (M–F)</h2>
      </body></html>
    `);
    expect(parser.extractWeekNumber(dom.window.document)).toBe(14);
  });

  it("extracts week number from Vecka XX pattern", () => {
    const dom = new JSDOM(`
      <html><body>
        <h2>Lunchmeny Vecka 7</h2>
      </body></html>
    `);
    expect(parser.extractWeekNumber(dom.window.document)).toBe(7);
  });

  it("extracts dishes with categories and prices", () => {
    const dom = new JSDOM(SAMPLE_HTML);
    const dishes = parser.extractDishes(dom.window.document);

    expect(dishes).toHaveLength(4);

    expect(dishes[0]).toMatchObject({
      name: "Kött",
      price: 195,
    });
    expect(dishes[0].description).toContain("entrecôte");

    expect(dishes[1]).toMatchObject({
      name: "Fisk",
      price: 185,
    });
    expect(dishes[1].description).toContain("torsk");

    expect(dishes[2]).toMatchObject({
      name: "Veg",
      price: 175,
    });
    expect(dishes[2].description).toContain("Halloumiburgare");

    expect(dishes[3]).toMatchObject({
      name: "Sallad",
      price: 165,
    });
    expect(dishes[3].description).toContain("Caesarsallad");
  });

  it("creates 5 lunches per dish (one per weekday)", () => {
    const dom = new JSDOM(SAMPLE_HTML);
    parser.fetchDocument = async () => dom.window.document;

    return parser.parseMenu().then((lunches) => {
      // 4 dishes * 5 weekdays = 20 lunches
      expect(lunches).toHaveLength(20);

      const weekdays = lunches.slice(0, 5).map((l) => l.weekday);
      expect(weekdays).toEqual([
        "måndag",
        "tisdag",
        "onsdag",
        "torsdag",
        "fredag",
      ]);

      for (const lunch of lunches) {
        expect(lunch.week).toBe(14);
        expect(lunch.place).toBe("COMO");
      }
    });
  });

  it("returns empty array when no Lunchmeny heading found", () => {
    const dom = new JSDOM(`
      <html><body>
        <h2>Middagsmeny</h2>
        <p>Pasta – 200 kr</p>
      </body></html>
    `);
    const dishes = parser.extractDishes(dom.window.document);
    expect(dishes).toHaveLength(0);
  });

  it("handles category inline with heading text", () => {
    const dom = new JSDOM(`
      <html><body>
        <h2>Lunchmeny V.10</h2>
        <h3>Kött: Pulled pork med coleslaw – 180 kr</h3>
      </body></html>
    `);
    const dishes = parser.extractDishes(dom.window.document);

    expect(dishes).toHaveLength(1);
    expect(dishes[0]).toMatchObject({
      name: "Kött",
      price: 180,
    });
    expect(dishes[0].description).toContain("Pulled pork");
  });
});
