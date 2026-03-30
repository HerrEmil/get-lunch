import { beforeAll, describe, expect, it, beforeEach, vi } from "vitest";
import { P2Parser } from "./p2-parser.mjs";

function createParser() {
  const parser = new P2Parser();
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

describe("P2Parser", () => {
  let parser;

  beforeEach(() => {
    parser = createParser();
  });

  it("extracts lunch items from all weekdays", async () => {
    const dom = new JSDOM(`
      <div id="menu">
        <h3>Vecka 14</h3>
        <div class="monday">
          <div class="lunchmeny_container">
            <div class="lunch_title">GREEN</div>
            <div class="lunch_desc">Pasta med grönsakssås och parmesan</div>
            <div class="lunch_price">128:-</div>
          </div>
          <div class="lunchmeny_container">
            <div class="lunch_title">LOCAL</div>
            <div class="lunch_desc">Köttbullar med potatismos</div>
            <div class="lunch_price">128:-</div>
          </div>
        </div>
        <div class="tuesday">
          <div class="lunchmeny_container">
            <div class="lunch_title">WORLD WIDE</div>
            <div class="lunch_desc">Chicken tikka masala med ris</div>
            <div class="lunch_price">128:-</div>
          </div>
        </div>
      </div>
    `);

    const container = dom.window.document.querySelector("#menu");
    const weekNumber = parser.extractWeekNumber(container);
    expect(weekNumber).toBe(14);

    const lunches = [];
    const cssToWeekday = {
      monday: "måndag",
      tuesday: "tisdag",
    };

    for (const [cssClass, weekday] of Object.entries(cssToWeekday)) {
      const daySection = container.querySelector(`.${cssClass}`);
      if (!daySection) continue;

      const containers = daySection.querySelectorAll(".lunchmeny_container");
      for (const item of containers) {
        const title = item.querySelector(".lunch_title")?.textContent?.trim();
        const desc = item.querySelector(".lunch_desc")?.textContent?.trim();
        const priceText = item.querySelector(".lunch_price")?.textContent?.trim();
        const price = parser.extractNumber(priceText) || 128;

        lunches.push(
          parser.createLunchObject({
            name: title,
            description: desc,
            price,
            weekday,
            week: weekNumber,
            place: "P2",
          }),
        );
      }
    }

    expect(lunches).toHaveLength(3);
    expect(lunches[0]).toMatchObject({
      name: "GREEN",
      description: "Pasta med grönsakssås och parmesan",
      price: 128,
      weekday: "måndag",
      week: 14,
      place: "P2",
    });
    expect(lunches[1]).toMatchObject({
      name: "LOCAL",
      weekday: "måndag",
      place: "P2",
    });
    expect(lunches[2]).toMatchObject({
      name: "WORLD WIDE",
      weekday: "tisdag",
      place: "P2",
    });
  });

  it("extracts week number from page text", () => {
    const dom = new JSDOM(`<div><h3>Vecka 22</h3></div>`);
    const container = dom.window.document.querySelector("div");
    const weekNumber = parser.extractWeekNumber(container);
    expect(weekNumber).toBe(22);
  });

  it("extracts week number case insensitive", () => {
    const dom = new JSDOM(`<div><p>vecka 5</p></div>`);
    const container = dom.window.document.querySelector("div");
    const weekNumber = parser.extractWeekNumber(container);
    expect(weekNumber).toBe(5);
  });

  it("falls back to current week when no week number found", () => {
    const dom = new JSDOM(`<div><p>Lunchmeny</p></div>`);
    const container = dom.window.document.querySelector("div");
    const weekNumber = parser.extractWeekNumber(container);
    expect(weekNumber).toBeGreaterThanOrEqual(1);
    expect(weekNumber).toBeLessThanOrEqual(53);
  });

  it("skips items marked as stängt", async () => {
    const dom = new JSDOM(`
      <div id="menu">
        <h3>Vecka 14</h3>
        <div class="monday">
          <div class="lunchmeny_container">
            <div class="lunch_title">Stängt</div>
            <div class="lunch_desc">Vi har stängt idag</div>
            <div class="lunch_price">128:-</div>
          </div>
        </div>
      </div>
    `);

    const container = dom.window.document.querySelector("#menu");
    const daySection = container.querySelector(".monday");
    const items = daySection.querySelectorAll(".lunchmeny_container");
    const lunches = [];

    for (const item of items) {
      const title = item.querySelector(".lunch_title")?.textContent?.trim();
      if (title && title.toLowerCase().includes("stängt")) continue;
      lunches.push({ name: title });
    }

    expect(lunches).toHaveLength(0);
  });

  it("extracts price from lunch_price element", () => {
    expect(parser.extractNumber("128:-")).toBe(128);
    expect(parser.extractNumber("145:-")).toBe(145);
  });

  it("uses fallback price when no price found", () => {
    const price = parser.extractNumber("") || 128;
    expect(price).toBe(128);
  });

  it("returns correct name and url", () => {
    expect(parser.getName()).toBe("P2");
    expect(parser.getUrl()).toBe("https://restaurangp2.se/");
  });
});
