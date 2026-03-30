import { beforeAll, describe, expect, it, beforeEach, vi } from "vitest";
import { VarvParser } from "./varv-parser.mjs";

function createParser() {
  const parser = new VarvParser();
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

describe("VarvParser", () => {
  let parser;

  beforeEach(() => {
    parser = createParser();
  });

  it("extracts week number from H1", () => {
    const dom = new JSDOM(`
      <html><body>
        <h1>Lunch menu week 14, 11:30 — 14:00</h1>
      </body></html>
    `);
    const document = dom.window.document;
    expect(parser.extractWeekNumber(document)).toBe(14);
  });

  it("extracts price from H2", () => {
    const dom = new JSDOM(`
      <html><body>
        <h2>Lunch for 145</h2>
      </body></html>
    `);
    const document = dom.window.document;
    expect(parser.extractPrice(document)).toBe(145);
  });

  it("extracts dishes grouped by day with Swedish weekday names", () => {
    const dom = new JSDOM(`
      <html><body>
        <h1>Lunch menu week 14, 11:30 — 14:00</h1>
        <h2>Lunch for 145</h2>
        <p>All lunches include salad and bread.</p>
        <h2>Monday</h2>
        <p>Beef tartare, soy, jerusalem artichokes, coriander &amp; fries</p>
        <p>Pointed cabbage, hummous, harissa, almonds &amp; mint</p>
        <h2>Tuesday</h2>
        <p>Cottage pie (beef mince topped with potato mash)</p>
        <p>Gnocchi, taleggio, radicchio, peppers</p>
      </body></html>
    `);
    const document = dom.window.document;
    const dayDishes = parser.extractDayDishes(document);

    expect(dayDishes).toHaveLength(2);

    expect(dayDishes[0].weekday).toBe("måndag");
    expect(dayDishes[0].dishes).toHaveLength(2);
    expect(dayDishes[0].dishes[0]).toContain("Beef tartare");
    expect(dayDishes[0].dishes[1]).toContain("Pointed cabbage");

    expect(dayDishes[1].weekday).toBe("tisdag");
    expect(dayDishes[1].dishes).toHaveLength(2);
    expect(dayDishes[1].dishes[0]).toContain("Cottage pie");
    expect(dayDishes[1].dishes[1]).toContain("Gnocchi");
  });

  it("extracts full menu data end-to-end", () => {
    const dom = new JSDOM(`
      <html><body>
        <h1>Lunch menu week 14, 11:30 — 14:00</h1>
        <h2>Lunch for 145</h2>
        <p>All lunches include salad and bread.</p>
        <h2>Monday</h2>
        <p>Beef tartare, soy, jerusalem artichokes, coriander &amp; fries</p>
        <p>Pointed cabbage, hummous, harissa, almonds &amp; mint</p>
        <h2>Tuesday</h2>
        <p>Cottage pie (beef mince topped with potato mash)</p>
        <p>Gnocchi, taleggio, radicchio, peppers</p>
        <h2>Wednesday</h2>
        <p>Fish and chips</p>
        <p>Mushroom risotto</p>
        <h2>Thursday</h2>
        <p>Steak frites</p>
        <p>Cauliflower gratin</p>
        <h2>Friday</h2>
        <p>Fish tacos</p>
        <p>Bean burrito</p>
      </body></html>
    `);
    const document = dom.window.document;
    const { week, price, dayDishes } = parser.extractMenuData(document);

    expect(week).toBe(14);
    expect(price).toBe(145);
    expect(dayDishes).toHaveLength(5);
    expect(dayDishes[4].weekday).toBe("fredag");
  });

  it("returns empty array when no day headings found", () => {
    const dom = new JSDOM(`
      <html><body>
        <h1>Lunch menu week 14</h1>
        <p>No menu this week</p>
      </body></html>
    `);
    const document = dom.window.document;
    const dayDishes = parser.extractDayDishes(document);
    expect(dayDishes).toHaveLength(0);
  });

  it("skips non-day H2 headings", () => {
    const dom = new JSDOM(`
      <html><body>
        <h2>Lunch for 145</h2>
        <h2>Monday</h2>
        <p>Dish 1</p>
        <h2>Special offers</h2>
        <p>Some promo text</p>
        <h2>Tuesday</h2>
        <p>Dish 2</p>
      </body></html>
    `);
    const document = dom.window.document;
    const dayDishes = parser.extractDayDishes(document);

    expect(dayDishes).toHaveLength(2);
    expect(dayDishes[0].weekday).toBe("måndag");
    expect(dayDishes[1].weekday).toBe("tisdag");
  });

  it("returns correct getName and getUrl", () => {
    expect(parser.getName()).toBe("Varv");
    expect(parser.getUrl()).toBe("https://varvmalmo.com/menu");
  });
});
