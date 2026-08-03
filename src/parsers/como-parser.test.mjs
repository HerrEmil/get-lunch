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

// Matches the winter site structure (homepage menu overlay): a <section> wraps
// the H2 heading and a UL; each LI nests the category <h3> + description <p> in
// a div, with the price in a separate trailing <p>.
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

// Matches the summer 2026 template: same LI structure, but the H2 says
// "Sommarlunch" (no week number anywhere on the page) and the <h3> holds the
// dish name directly instead of a kött/fisk/veg/sallad category. The evening
// menu ("Sommarmeny") and dessert ("sött") sections share the markup but must
// be excluded; their items carry no description <p>.
const SUMMER_HTML = `
<html><body>
  <div id="menu-content">
    <section class="mb-12 text-black">
      <h2 class="uppercase tracking-widest">
        Sommarlunch (11:30–14:00, M–F)</h2>
      <ul>
        <li class="flex items-baseline justify-between">
          <div class="flex-1">
            <h3>
              Sallad Niçoise</h3>
            <p>Tonfisk, oliver, färskpotatis, sardell,
ägg, krutong &amp; nobisdressing</p>
          </div>
          <p>
            195</p>
        </li>
        <li class="flex items-baseline justify-between">
          <div class="flex-1">
            <h3>
              Grillat kycklingspett</h3>
            <p>Gurka, yoghurt, ras el hanout,
mynta &amp; rostad potatis</p>
          </div>
          <p>
            185</p>
        </li>
      </ul>
    </section>
    <section class="mb-12 text-black">
      <h2>Sommarmeny</h2>
      <ul>
        <li>
          <div class="flex-1"><h3>Oliver &amp; Piparras</h3></div>
          <p>65</p>
        </li>
        <li>
          <div class="flex-1"><h3>Gillardeau ostron &amp; spicy lemon</h3></div>
          <p>35/st</p>
        </li>
      </ul>
    </section>
    <section>
      <h2>sött</h2>
      <ul>
        <li><div class="flex-1"><h3>chokladtryffel</h3></div><p>35</p></li>
      </ul>
    </section>
  </div>
</body></html>
`;

// Captured from comomalmo.se on 2026-08-03. Same summer template and the same
// LI structure, but the CMS now publishes the lunch items with an EMPTY <h3>
// (whitespace only) and the whole dish text in the description <p> — note it
// is the SAME dish at the SAME price as SUMMER_HTML's "Sallad Niçoise" 195,
// just with the title folded into the description. The evening/dessert
// sections are unchanged and still carry titled, description-less items.
const SUMMER_UNTITLED_HTML = `
<html><body>
  <div id="menu-content">
    <section class="mb-12 text-black">
      <h2 class="uppercase tracking-widest">
        Sommarlunch (11:30–14:00, M–F)</h2>
      <ul>
        <li class="flex items-baseline justify-between">
          <div class="flex-1">
            <h3 class="uppercase tracking-wide">
            </h3>
            <p>sallad niçoise,
halstrad tonfisk, ägg,
haricot vertes, tomat
&amp; sardell</p>
          </div>
          <p>
            195</p>
        </li>
        <li class="flex items-baseline justify-between">
          <div class="flex-1">
            <h3 class="uppercase tracking-wide">
            </h3>
            <p>grillat kycklingbröst,
caesarsallad, friterad potatis
&amp; parmesan</p>
          </div>
          <p>
            185</p>
        </li>
        <li class="flex items-baseline justify-between">
          <div class="flex-1">
            <h3 class="uppercase tracking-wide">
            </h3>
          </div>
          <p>
            95</p>
        </li>
      </ul>
    </section>
    <section class="mb-12 text-black">
      <h2>Sommarmeny</h2>
      <ul>
        <li>
          <div class="flex-1"><h3>Oliver &amp; Piparras</h3></div>
          <p>65</p>
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

  describe("summer template", () => {
    it("extracts dish names from h3 under the Sommarlunch heading", () => {
      const dom = new JSDOM(SUMMER_HTML);
      const dishes = parser.extractDishes(dom.window.document);

      expect(dishes).toHaveLength(2);

      expect(dishes[0]).toMatchObject({ name: "Sallad Niçoise", price: 195 });
      expect(dishes[0].description).toBe(
        "Tonfisk, oliver, färskpotatis, sardell, ägg, krutong & nobisdressing",
      );

      expect(dishes[1]).toMatchObject({
        name: "Grillat kycklingspett",
        price: 185,
      });
      expect(dishes[1].description).toBe(
        "Gurka, yoghurt, ras el hanout, mynta & rostad potatis",
      );
    });

    it("excludes Sommarmeny (evening) and sött (dessert) sections", () => {
      const dom = new JSDOM(SUMMER_HTML);
      const dishes = parser.extractDishes(dom.window.document);
      const names = dishes.map((d) => d.name.toLowerCase());
      expect(names).not.toContain("oliver & piparras");
      expect(names).not.toContain("gillardeau ostron & spicy lemon");
      expect(names).not.toContain("chokladtryffel");
    });

    it("falls back to the current week when the page has no week number", async () => {
      const dom = new JSDOM(SUMMER_HTML);
      parser.fetchDocument = async () => dom.window.document;

      const lunches = await parser.parseMenu();

      // 2 dishes * 5 weekdays
      expect(lunches).toHaveLength(10);

      const weekdays = lunches.slice(0, 5).map((l) => l.weekday);
      expect(weekdays).toEqual(["måndag", "tisdag", "onsdag", "torsdag", "fredag"]);

      for (const lunch of lunches) {
        expect(lunch.week).toBe(parser._getCurrentWeek());
        expect(lunch.place).toBe("COMO");
      }
    });
  });

  describe("summer template with untitled items (2026-08 markup)", () => {
    it("keeps priced lunch items whose h3 is empty, using the published text as the name", () => {
      const dom = new JSDOM(SUMMER_UNTITLED_HTML);
      const dishes = parser.extractDishes(dom.window.document);

      expect(dishes).toHaveLength(2);

      expect(dishes[0]).toMatchObject({
        name: "Sallad niçoise, halstrad tonfisk, ägg, haricot vertes, tomat & sardell",
        description: "",
        price: 195,
      });
      expect(dishes[1]).toMatchObject({
        name: "Grillat kycklingbröst, caesarsallad, friterad potatis & parmesan",
        description: "",
        price: 185,
      });
    });

    it("still skips an untitled item that publishes no dish text at all", () => {
      const dom = new JSDOM(SUMMER_UNTITLED_HTML);
      const dishes = parser.extractDishes(dom.window.document);
      // The third LI has an empty h3 and no description P — nothing is
      // published for it, so nothing is invented for it either.
      expect(dishes.map((d) => d.price)).not.toContain(95);
    });

    it("does not reach into the evening menu for a name", () => {
      const dom = new JSDOM(SUMMER_UNTITLED_HTML);
      const dishes = parser.extractDishes(dom.window.document);
      const names = dishes.map((d) => d.name.toLowerCase());
      expect(names).not.toContain("oliver & piparras");
    });

    it("creates 5 lunches per untitled dish", async () => {
      const dom = new JSDOM(SUMMER_UNTITLED_HTML);
      parser.fetchDocument = async () => dom.window.document;

      const lunches = await parser.parseMenu();

      // 2 dishes * 5 weekdays
      expect(lunches).toHaveLength(10);
      for (const lunch of lunches) {
        expect(lunch.name).not.toBe("");
        expect(lunch.price).toBeGreaterThan(0);
        expect(lunch.place).toBe("COMO");
      }
    });
  });
});
