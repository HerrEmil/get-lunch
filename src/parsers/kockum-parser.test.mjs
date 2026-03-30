import { beforeAll, describe, expect, it, beforeEach, vi } from "vitest";
import { KockumParser } from "./kockum-parser.mjs";

function createParser() {
  const parser = new KockumParser();
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
  <h1>136kr, ingår salladsbuffé, hembakat bröd & kaffe/te</h1>
  <p class="mobile-undersized-upper">Lunch vecka 14/2026</p>
  <p class="mobile-undersized-upper">Måndag</p>
  <p class="mobile-undersized-upper">Nötfärsbiff med kapris, rödbetor/ Dijon crème/ skysås</p>
  <p class="mobile-undersized-upper">Tisdag</p>
  <p class="mobile-undersized-upper">Fish & chips på sej/ citronmajonnäs/krasse</p>
  <p class="mobile-undersized-upper">Onsdag</p>
  <p class="mobile-undersized-upper">Schnitzel/tryffelmajonnäs/sprödsallad/skysås/riven parmesan</p>
  <p class="mobile-undersized-upper">Veckans vegetariska</p>
  <p class="mobile-undersized-upper">Marockansk gryta på quorn & kikärtor med yoghurt,</p>
  <p class="mobile-undersized-upper">rostad mandel & granatäpple</p>
  <p class="mobile-undersized-upper">Bön & fetaostbiffar/rostad paprikasås/spenat/rostad palsternacka</p>
  <p class="mobile-undersized-upper">GLAD PÅSK</p>
  <p>Smörrebröd</p>
</body></html>
`;

describe("KockumParser", () => {
  let parser;

  beforeEach(() => {
    parser = createParser();
  });

  it("has correct name and url", () => {
    expect(parser.getName()).toBe("Kockum Fritid");
    expect(parser.getUrl()).toContain("freda49.se");
  });

  it("extracts weekday dishes", () => {
    const doc = new JSDOM(SAMPLE_HTML).window.document;
    const lunches = parser.extractMenu(doc);

    const monday = lunches.filter((l) => l.weekday === "måndag" && !l.dietary?.includes("vegetarian"));
    expect(monday).toHaveLength(1);
    expect(monday[0].name).toContain("Nötfärsbiff");
    expect(monday[0].price).toBe(136);
    expect(monday[0].week).toBe(14);

    const tuesday = lunches.filter((l) => l.weekday === "tisdag" && !l.dietary?.includes("vegetarian"));
    expect(tuesday).toHaveLength(1);
    expect(tuesday[0].name).toContain("Fish & chips");
  });

  it("extracts vegetarian dishes for all weekdays", () => {
    const doc = new JSDOM(SAMPLE_HTML).window.document;
    const lunches = parser.extractMenu(doc);

    const vegMonday = lunches.filter(
      (l) => l.weekday === "måndag" && l.dietary?.includes("vegetarian"),
    );
    // Two veg dishes: Marockansk gryta + Bön & fetaostbiffar
    expect(vegMonday).toHaveLength(2);

    // First veg dish should have the continuation line merged
    expect(vegMonday[0].name).toContain("Marockansk gryta");
    expect(vegMonday[0].name).toContain("rostad mandel");
  });

  it("extracts week number", () => {
    const doc = new JSDOM(SAMPLE_HTML).window.document;
    const lunches = parser.extractMenu(doc);
    expect(lunches[0].week).toBe(14);
  });

  it("extracts price from text", () => {
    expect(parser.extractPrice("136kr, ingår salladsbuffé")).toBe(136);
    expect(parser.extractPrice("145 kr")).toBe(145);
  });

  it("stops at smörrebröd section", () => {
    const doc = new JSDOM(SAMPLE_HTML).window.document;
    const lunches = parser.extractMenu(doc);
    const names = lunches.map((l) => l.name).join(" ");
    expect(names).not.toContain("Smörrebröd");
    expect(names).not.toContain("Rostbiff");
  });

  it("returns empty for page with no menu", () => {
    const doc = new JSDOM("<html><body><p>Stängt</p></body></html>").window.document;
    const lunches = parser.extractMenu(doc);
    expect(lunches).toHaveLength(0);
  });
});
