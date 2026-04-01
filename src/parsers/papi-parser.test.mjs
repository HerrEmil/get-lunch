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

// Matches the real site structure: H2 section → UL → LI with H4 name + description + price
const MOCK_HTML = `
<html><body>
  <h2>Dagens – Ny pasta varje tisdag!</h2>
  <ul>
    <li><h4>Papis pasta</h4> Griskindsragu, aubergine, kapris, rökt ostsås 135kr</li>
    <li><h4>Papis Ravioli</h4> Ravioli med lamm, citron, smör, ärtor 165kr</li>
    <li><h4>Papis speciale</h4> Fettucine med smör och färsk tryffel 260kr</li>
    <li><h4>Parmigiana</h4> Lasagnevariant med aubergine, parmesan, tomat 155kr</li>
  </ul>
  <h2>Varje vecka:</h2>
  <ul>
    <li><h4>Bolognese</h4> Klassiker i Papi-tappning 145kr</li>
    <li><h4>Pasta all'Arrabbiata</h4> Pasta med mustig tomat, chiliolja, burrata 145kr</li>
    <li><h4>Vitello tonnato</h4> Tunt skuren kalv med tunamajonäs 110kr</li>
    <li><h4>Testa 2 rätter</h4> Doppio-meny! Prova två portioner 175kr</li>
    <li><h4>Pasta all in</h4> En meny med alla pastarätter 230kr</li>
    <li><h4>Arancini</h4> Friterad risotto-boll med citronmajonnäs 60kr</li>
    <li><h4>Sardeller</h4> Sardeller med bröd och smör 75kr</li>
    <li><h4>Ostbricka</h4> Dagens ostar 110kr</li>
    <li><h4>Charkbricka</h4> Dagens chark 195kr</li>
  </ul>
  <h2>Efter maten:</h2>
  <ul>
    <li><h4>Papis Tiramisu</h4> 85kr</li>
  </ul>
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
    expect(names).toContain("Vitello tonnato");
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

  it("skips appetizers, sides, desserts, and combos", () => {
    const dom = new JSDOM(MOCK_HTML);
    const dishes = parser.extractDishes(dom.window.document);

    const names = dishes.map((d) => d.name.toLowerCase());
    expect(names).not.toContain("arancini");
    expect(names).not.toContain("sardeller");
    expect(names).not.toContain("ostbricka");
    expect(names).not.toContain("charkbricka");
    expect(names).not.toContain("papis tiramisu");
    expect(names.some((n) => n.includes("pasta all in"))).toBe(false);
  });

  it("creates 5 lunches per dish (one per weekday)", async () => {
    const dom = new JSDOM(MOCK_HTML);
    parser.fetchDocument = async () => dom.window.document;

    const lunches = await parser.parseMenu();

    const dishes = parser.extractDishes(dom.window.document);
    expect(lunches).toHaveLength(dishes.length * 5);

    const papisLunches = lunches.filter((l) => l.name === "Papis pasta");
    expect(papisLunches).toHaveLength(5);
    expect(papisLunches.map((l) => l.weekday)).toEqual([
      "måndag", "tisdag", "onsdag", "torsdag", "fredag",
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
    const dom = new JSDOM(`<html><body><h1>PAPI</h1><p>Välkommen!</p></body></html>`);
    parser.fetchDocument = async () => dom.window.document;

    const lunches = await parser.parseMenu();
    expect(lunches).toHaveLength(0);
  });
});
