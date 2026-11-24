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

  it("extracts single-paragraph dishes (name – price<br>description), week 48 layout", () => {
    // Trimmed from the live lafonderie.se/lunch markup, 2026-11-24 (v.48)
    const dom = new JSDOM(`
      <html><body>
        <h1>LE LUNCH v.48</h1>
        <h4><strong>VECKANS LUNCH</strong></h4>
        <p class="p2"><strong>Paleron de bœuf braisé – 195</strong><br>Nattbakat högrev med skogschampinjoner, jordärtskocka, bakad silverlök, sviskon &amp; jus</p>
        <p class="p2"></p>
        <p class="p1"><strong>Filet de sandre poêlé – 225</strong><br>Stekt gösfilé med smörad hönsvelouté, kålrabbi, grönkål, picklad majrova &amp; pepparrot</p>
        <p class="p2"></p>
        <p class="p1"><strong>Endives braisées au vin – 195</strong><br>Vinbräserad endive med valnötter, päron, Gruyèrecrème &amp; picklade gulbetor</p>
        <p class="p2"></p>
        <p class="p1">Alla rätter serveras med smörslungad potatis</p>
        <h4></h4>
        <h4>La Fonderie Classique</h4>
        <p><strong>Steak Frites – 385</strong></p>
        <p>Onglet (serveras Medium Rare), pommes frites &amp; sauce béarnaise</p>
      </body></html>
    `);
    const document = dom.window.document;
    const dishes = parser.extractWeeklyDishes(document);

    expect(dishes).toEqual([
      {
        name: "Paleron de bœuf braisé",
        description:
          "Nattbakat högrev med skogschampinjoner, jordärtskocka, bakad silverlök, sviskon & jus",
        price: 195,
      },
      {
        name: "Filet de sandre poêlé",
        description:
          "Stekt gösfilé med smörad hönsvelouté, kålrabbi, grönkål, picklad majrova & pepparrot",
        price: 225,
      },
      {
        name: "Endives braisées au vin",
        description:
          "Vinbräserad endive med valnötter, päron, Gruyèrecrème & picklade gulbetor",
        price: 195,
      },
    ]);
    expect(parser.extractWeekNumber(document)).toBe(48);
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
    expect(parser.getUrl()).toBe("https://www.lafonderie.se/lunch");
  });
});
