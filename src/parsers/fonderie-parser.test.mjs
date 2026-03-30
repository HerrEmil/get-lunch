import { beforeAll, describe, expect, it, beforeEach, vi } from "vitest";
import { FonderieParser } from "./fonderie-parser.mjs";

function createParser() {
  const parser = new FonderieParser();
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

describe("FonderieParser", () => {
  let parser;

  beforeEach(() => {
    parser = createParser();
  });

  it("extracts week number from H1", () => {
    const dom = new JSDOM(`
      <html><body>
        <h1>LE LUNCH v.14</h1>
      </body></html>
    `);
    const document = dom.window.document;
    expect(parser.extractWeekNumber(document)).toBe(14);
  });

  it("extracts weekly dishes with prices from VECKANS section", () => {
    const dom = new JSDOM(`
      <html><body>
        <h1>LE LUNCH v.14</h1>
        <p>(Serveras måndag till fredag 11:30 - 15:00)</p>
        <h4>VECKANS</h4>
        <p>Rödvinsbräserat lammlägg</p>
        <p>glaserade morötter, spenat, pistage &amp; salvia – 195 kr</p>
        <p>Bouillabaisse med lax, torsk &amp; blåmusslor</p>
        <p>rouille, bladpersilja- &amp; schalottenlöksallad – 195 kr</p>
        <p>Rostad butternutpumpa</p>
        <p>sandefjordsås, picklad chili, Gruyère &amp; jordärtskockschips – 185 kr</p>
        <p>Alla rätter serveras med smörslungad potatis</p>
      </body></html>
    `);
    const document = dom.window.document;
    const dishes = parser.extractWeeklyDishes(document);

    expect(dishes).toHaveLength(3);

    expect(dishes[0]).toMatchObject({
      name: "Rödvinsbräserat lammlägg",
      price: 195,
    });
    expect(dishes[0].description).toContain("glaserade morötter");

    expect(dishes[1]).toMatchObject({
      name: "Bouillabaisse med lax, torsk & blåmusslor",
      price: 195,
    });

    expect(dishes[2]).toMatchObject({
      name: "Rostad butternutpumpa",
      price: 185,
    });
  });

  it("skips general note lines without price", () => {
    const dom = new JSDOM(`
      <html><body>
        <h4>VECKANS</h4>
        <p>Pasta carbonara</p>
        <p>grädde, pancetta &amp; parmesan – 165 kr</p>
        <p>Alla rätter serveras med smörslungad potatis</p>
      </body></html>
    `);
    const document = dom.window.document;
    const dishes = parser.extractWeeklyDishes(document);

    expect(dishes).toHaveLength(1);
    expect(dishes[0].name).toBe("Pasta carbonara");
  });

  it("creates lunch objects for all five weekdays per dish", () => {
    const dom = new JSDOM(`
      <html><body>
        <h1>LE LUNCH v.14</h1>
        <h4>VECKANS</h4>
        <p>Pasta carbonara</p>
        <p>grädde, pancetta &amp; parmesan – 165 kr</p>
      </body></html>
    `);

    // Mock fetchDocument to return our fixture
    parser.fetchDocument = async () => dom.window.document;

    return parser.parseMenu().then((lunches) => {
      expect(lunches).toHaveLength(5);

      const weekdays = lunches.map((l) => l.weekday);
      expect(weekdays).toEqual([
        "måndag",
        "tisdag",
        "onsdag",
        "torsdag",
        "fredag",
      ]);

      for (const lunch of lunches) {
        expect(lunch).toMatchObject({
          name: "Pasta carbonara",
          price: 165,
          week: 14,
          place: "La Fonderie",
        });
      }
    });
  });

  it("returns empty array when no VECKANS heading found", () => {
    const dom = new JSDOM(`
      <html><body>
        <h1>LE LUNCH v.14</h1>
        <p>Stängt denna vecka</p>
      </body></html>
    `);
    const document = dom.window.document;
    const dishes = parser.extractWeeklyDishes(document);
    expect(dishes).toHaveLength(0);
  });

  it("stops collecting paragraphs at next heading", () => {
    const dom = new JSDOM(`
      <html><body>
        <h4>VECKANS</h4>
        <p>Grillad lax</p>
        <p>dillsås &amp; potatis – 175 kr</p>
        <h4>DESSERT</h4>
        <p>Crème brûlée</p>
        <p>vanilj &amp; bär – 85 kr</p>
      </body></html>
    `);
    const document = dom.window.document;
    const dishes = parser.extractWeeklyDishes(document);

    expect(dishes).toHaveLength(1);
    expect(dishes[0].name).toBe("Grillad lax");
  });

  it("strips price suffix from description", () => {
    const dom = new JSDOM(`
      <html><body>
        <h4>VECKANS</h4>
        <p>Entrecôte</p>
        <p>bearnaisesås, pommes frites – 225 kr</p>
      </body></html>
    `);
    const document = dom.window.document;
    const dishes = parser.extractWeeklyDishes(document);

    expect(dishes[0].description).toBe("bearnaisesås, pommes frites");
  });

  it("returns correct getName and getUrl", () => {
    expect(parser.getName()).toBe("La Fonderie");
    expect(parser.getUrl()).toBe("https://www.lafonderie.se/lelunch");
  });
});
