import { beforeAll, describe, expect, it, beforeEach, vi } from "vitest";
import { PapiParser } from "./papi-parser.mjs";

function createParser() {
  const parser = new PapiParser();
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

const MOCK_HTML = `
<html><body>
  <h2>Dagens – Ny pasta varje tisdag!</h2>
  <h4>Papis pasta</h4>
  <p>Veckans pastarätt med säsongens bästa råvaror</p>
  <p>135 kr</p>

  <h4>Papis Ravioli</h4>
  <p>Hemgjord ravioli med ricotta och spenat</p>
  <p>165 kr</p>

  <h4>Papis speciale</h4>
  <p>Lyxig pasta med tryffel och parmesan</p>
  <p>260 kr</p>

  <h2>Varje vecka:</h2>
  <h4>Parmigiana</h4>
  <p>Klassisk aubergine parmigiana</p>
  <p>155 kr</p>

  <h4>Bolognese</h4>
  <p>Långkokt köttfärssås med tagliatelle</p>
  <p>145 kr</p>

  <h4>Pasta all'Arrabbiata</h4>
  <p>Het tomatsås med vitlök och chili</p>
  <p>145 kr</p>

  <h2>Antipasti</h2>
  <h4>Arancini</h4>
  <p>Friterade risbollar med mozzarella</p>
  <p>85 kr</p>

  <h4>Sardeller</h4>
  <p>Marinerade sardeller med citron</p>
  <p>75 kr</p>

  <h4>Ostbricka</h4>
  <p>Urval av italienska ostar</p>
  <p>125 kr</p>

  <h4>Charkbricka</h4>
  <p>Italiensk chark</p>
  <p>135 kr</p>

  <h2>Dessert</h2>
  <h4>Tiramisu</h4>
  <p>Klassisk italiensk dessert</p>
  <p>95 kr</p>

  <h2>Erbjudanden</h2>
  <h4>Doppio-meny</h4>
  <p>Två pastarätter</p>
  <p>250 kr</p>

  <h4>Pasta all in</h4>
  <p>Pasta, förrätt och dessert</p>
  <p>350 kr</p>
</body></html>
`;

describe("PapiParser", () => {
  let parser;

  beforeEach(() => {
    parser = createParser();
  });

  it("has correct name and url", () => {
    expect(parser.getName()).toBe("PAPI");
    expect(parser.getUrl()).toBe("https://www.papisaluhallen.se/");
  });

  it("extracts dishes from menu sections", () => {
    const dom = new JSDOM(MOCK_HTML);
    const dishes = parser.extractDishes(dom.window.document);

    const names = dishes.map((d) => d.name);
    expect(names).toContain("Papis pasta");
    expect(names).toContain("Papis Ravioli");
    expect(names).toContain("Parmigiana");
    expect(names).toContain("Bolognese");
    expect(names).toContain("Pasta all'Arrabbiata");
  });

  it("extracts correct prices", () => {
    const dom = new JSDOM(MOCK_HTML);
    const dishes = parser.extractDishes(dom.window.document);

    const byName = Object.fromEntries(dishes.map((d) => [d.name, d.price]));
    expect(byName["Papis pasta"]).toBe(135);
    expect(byName["Papis Ravioli"]).toBe(165);
    expect(byName["Parmigiana"]).toBe(155);
    expect(byName["Bolognese"]).toBe(145);
  });

  it("skips appetizers and sides", () => {
    const dom = new JSDOM(MOCK_HTML);
    const dishes = parser.extractDishes(dom.window.document);

    const names = dishes.map((d) => d.name.toLowerCase());
    expect(names).not.toContain("arancini");
    expect(names).not.toContain("sardeller");
    expect(names).not.toContain("ostbricka");
    expect(names).not.toContain("charkbricka");
  });

  it("skips desserts", () => {
    const dom = new JSDOM(MOCK_HTML);
    const dishes = parser.extractDishes(dom.window.document);

    const names = dishes.map((d) => d.name.toLowerCase());
    expect(names).not.toContain("tiramisu");
  });

  it("skips combo deals", () => {
    const dom = new JSDOM(MOCK_HTML);
    const dishes = parser.extractDishes(dom.window.document);

    const names = dishes.map((d) => d.name.toLowerCase());
    expect(names.some((n) => n.includes("doppio-meny"))).toBe(false);
    expect(names.some((n) => n.includes("pasta all in"))).toBe(false);
  });

  it("creates 5 lunches per dish (one per weekday)", async () => {
    const dom = new JSDOM(MOCK_HTML);
    parser.fetchDocument = async () => dom.window.document;

    const lunches = await parser.parseMenu();

    // Count dishes first
    const dishes = parser.extractDishes(dom.window.document);
    expect(lunches).toHaveLength(dishes.length * 5);

    // Verify all weekdays present for each dish
    const papisLunches = lunches.filter((l) => l.name === "Papis pasta");
    expect(papisLunches).toHaveLength(5);

    const weekdays = papisLunches.map((l) => l.weekday);
    expect(weekdays).toEqual([
      "måndag",
      "tisdag",
      "onsdag",
      "torsdag",
      "fredag",
    ]);
  });

  it("sets place to PAPI on all lunches", async () => {
    const dom = new JSDOM(MOCK_HTML);
    parser.fetchDocument = async () => dom.window.document;

    const lunches = await parser.parseMenu();
    for (const lunch of lunches) {
      expect(lunch.place).toBe("PAPI");
    }
  });

  it("returns empty array when page has no menu sections", async () => {
    const dom = new JSDOM(`
      <html><body>
        <h1>PAPI Saluhallen</h1>
        <p>Välkommen!</p>
      </body></html>
    `);
    parser.fetchDocument = async () => dom.window.document;

    const lunches = await parser.parseMenu();
    expect(lunches).toHaveLength(0);
  });
});
