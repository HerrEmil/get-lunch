import { beforeAll, describe, expect, it, beforeEach, vi } from "vitest";
import { Kitchen961Parser } from "./kitchen961-parser.mjs";

// Real markup captured from https://kitchen961.se/lunchen/ (WordPress/Elementor).
// Fixed Lebanese buffé: no per-day dishes, no week number on the page.
const MOCK_HTML = `
<html><body>
  <main>
    <div class="elementor-element elementor-widget elementor-widget-heading" data-widget_type="heading.default">
      <div class="elementor-widget-container">
        <h1 class="elementor-heading-title elementor-size-default">Lunchbuffé</h1>
      </div>
    </div>
    <div class="elementor-element elementor-widget elementor-widget-text-editor" data-widget_type="text-editor.default">
      <div class="elementor-widget-container">
        <p>Måndag-Fredag 11.00 &#8211; 14.30</p>
        <p>Dagens lunch 149 kr/ Fredagar 169 kr. Barn 90 kr ( upptill 10 år ) Takeaway 120 kr</p>
      </div>
    </div>
    <div class="elementor-element elementor-widget elementor-widget-heading" data-widget_type="heading.default">
      <div class="elementor-widget-container">
        <h3 class="elementor-heading-title elementor-size-default">Libanesisk lunchbuffé</h3>
      </div>
    </div>
    <div class="elementor-element elementor-widget elementor-widget-text-editor" data-widget_type="text-editor.default">
      <div class="elementor-widget-container">
        <p>Meza; Libanesisk Salladsbuffe. Varmrätter enligt menyn där du kan välja från alla rätter, kaffe, te, kaka och fruktfat.</p>
      </div>
    </div>
  </main>
</body></html>
`;

function createParser() {
  const parser = new Kitchen961Parser();
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

describe("Kitchen961Parser", () => {
  let parser;

  beforeEach(() => {
    parser = createParser();
  });

  it("returns correct name and url", () => {
    expect(parser.getName()).toBe("Kitchen961");
    expect(parser.getUrl()).toBe("https://kitchen961.se/lunchen/");
  });

  it("extracts weekday and Friday prices from page text", () => {
    const dom = new JSDOM(MOCK_HTML);
    const { weekdayPrice, fridayPrice } = parser.extractPrices(dom.window.document);
    expect(weekdayPrice).toBe(149);
    expect(fridayPrice).toBe(169);
  });

  it("extracts the buffé description from page text", () => {
    const dom = new JSDOM(MOCK_HTML);
    const description = parser.extractDescription(dom.window.document);
    expect(description).toContain("Meza");
    expect(description).toContain("Libanesisk Salladsbuffe");
    expect(description).toMatch(/fruktfat\.?$/);
  });

  it("falls back to weekday price for Friday when no Friday price is published", () => {
    const dom = new JSDOM(
      `<html><body><p>Dagens lunch 149 kr. Takeaway 120 kr</p></body></html>`,
    );
    const { weekdayPrice, fridayPrice } = parser.extractPrices(dom.window.document);
    expect(weekdayPrice).toBe(149);
    expect(fridayPrice).toBe(149);
  });

  it("falls back to default description when pattern not found", () => {
    const dom = new JSDOM(`<html><body><p>Välkommen!</p></body></html>`);
    const description = parser.extractDescription(dom.window.document);
    expect(description).toBe("Måndag-Fredag 11.00 – 14.30");
  });

  it("creates one buffé lunch per weekday with the higher Friday price", async () => {
    const dom = new JSDOM(MOCK_HTML);
    parser.fetchDocument = async () => dom.window.document;

    const lunches = await parser.parseMenu();

    expect(lunches).toHaveLength(5);
    expect(lunches[0]).toMatchObject({
      name: "Libanesisk lunchbuffé",
      price: 149,
      weekday: "måndag",
      place: "Kitchen961",
    });
    expect(lunches[4]).toMatchObject({
      weekday: "fredag",
      price: 169,
    });

    // All entries share the same (computed) week
    const weeks = new Set(lunches.map((l) => l.week));
    expect(weeks.size).toBe(1);
  });

  it("returns price 0 when no price found", () => {
    const dom = new JSDOM(`<html><body><p>Ingen prisinfo här</p></body></html>`);
    const { weekdayPrice, fridayPrice } = parser.extractPrices(dom.window.document);
    expect(weekdayPrice).toBe(0);
    expect(fridayPrice).toBe(0);
  });
});
