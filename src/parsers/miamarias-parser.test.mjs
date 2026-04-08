import { beforeAll, describe, expect, it, beforeEach, vi } from "vitest";
import { MiaMariasParser } from "./miamarias-parser.mjs";

function createParser() {
  const parser = new MiaMariasParser();
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

describe("MiaMariasParser", () => {
  let parser;

  beforeEach(() => {
    parser = createParser();
  });

  it("has correct name and url", () => {
    expect(parser.getName()).toBe("MiaMarias");
    expect(parser.getUrl()).toBe("https://miamarias.nu/lunch/");
  });

  it("extracts dishes grouped by category and day", () => {
    const dom = new JSDOM(`
      <div>
        <h2>Vecka 14</h2>
        <p>Intro text</p>
        <h2>Fisk</h2>
        <p>Kummel med saffranssås</p>
        <p>130:-</p>
        <h2>Kött</h2>
        <p>Färsbiffar med potatismos</p>
        <p>125:-</p>
        <h2>Vegetariskt</h2>
        <p>Ugnspannkaka med sallad</p>
        <p>120:-</p>
        <h2>Fisk</h2>
        <p>Stekt sill</p>
        <p>130:-</p>
        <h2>Kött</h2>
        <p>Burrito bowl med pulled pork</p>
        <p>125:-</p>
        <h2>Vegetariskt</h2>
        <p>Burrito bowl med oumphfärs</p>
        <p>120:-</p>
      </div>
    `);

    const lunches = parser.extractMenu(dom.window.document);

    expect(lunches.length).toBe(6);

    const monday = lunches.filter((l) => l.weekday === "måndag");
    expect(monday.length).toBe(3);
    expect(monday[0].name).toBe("Fisk");
    expect(monday[0].description).toContain("Kummel");
    expect(monday[0].price).toBe(130);
    expect(monday[1].name).toBe("Kött");
    expect(monday[1].price).toBe(125);
    expect(monday[2].name).toBe("Vegetariskt");
    expect(monday[2].price).toBe(120);

    const tuesday = lunches.filter((l) => l.weekday === "tisdag");
    expect(tuesday.length).toBe(3);
    expect(tuesday[0].description).toContain("sill");
  });

  it("extracts week number", () => {
    const dom = new JSDOM(`
      <div>
        <h2>Vecka 13</h2>
        <h2>Fisk</h2><p>Lax</p><p>130:-</p>
        <h2>Kött</h2><p>Biff</p><p>125:-</p>
        <h2>Vegetariskt</h2><p>Pasta</p><p>120:-</p>
      </div>
    `);

    const lunches = parser.extractMenu(dom.window.document);
    expect(lunches[0].week).toBe(13);
  });

  it("joins multi-paragraph dish descriptions before the price", () => {
    const dom = new JSDOM(`
      <div>
        <h2>Vecka 15</h2>
        <h2>Fisk</h2>
        <p>Röd currygryta med limemarinerad torsk</p>
        <p>130:-</p>
        <h2>Kött</h2>
        <p>Lasagne på nötfärs med</p>
        <p>tomat och mozzarellasallad</p>
        <p>125:-</p>
        <h2>Vegetariskt</h2>
        <p>Krämig sötpotatisdahl</p>
        <p>120:-</p>
      </div>
    `);

    const lunches = parser.extractMenu(dom.window.document);
    const kott = lunches.find((l) => l.name === "Kött");
    expect(kott.description).toBe(
      "Lasagne på nötfärs med tomat och mozzarellasallad",
    );
    expect(kott.price).toBe(125);
  });

  it("skips closed day headings", () => {
    const dom = new JSDOM(`
      <div>
        <h2>Vecka 14</h2>
        <h2>Fisk</h2><p>Lax</p><p>130:-</p>
        <h2>Kött</h2><p>Biff</p><p>125:-</p>
        <h2>Vegetariskt</h2><p>Pasta</p><p>120:-</p>
        <h2>Påskstängt!</h2>
        <h2>Fisk</h2><p>Torsk</p><p>130:-</p>
        <h2>Kött</h2><p>Fläsk</p><p>125:-</p>
        <h2>Vegetariskt</h2><p>Halloumi</p><p>120:-</p>
      </div>
    `);

    const lunches = parser.extractMenu(dom.window.document);

    const monday = lunches.filter((l) => l.weekday === "måndag");
    const wednesday = lunches.filter((l) => l.weekday === "onsdag");
    expect(monday.length).toBe(3);
    expect(wednesday.length).toBe(3);
  });
});
