import { beforeAll, describe, expect, it, beforeEach, vi } from "vitest";
import { TasteParser } from "./taste-parser.mjs";

function createParser() {
  const parser = new TasteParser();
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

describe("TasteParser", () => {
  let parser;

  beforeEach(() => {
    parser = createParser();
  });

  it("extracts lunches from current section", () => {
    const dom = new JSDOM(`
      <div id="wrapper">
        <div id="previous"><h2>Vecka 12</h2></div>
        <div id="current">
          <h2>Dagens lunch vecka 13</h2>
          <p>Pris: 135kr</p>
          <h6>Måndag</h6>
          <p>Kycklingfilé med dragonsås</p>
          <p class="eng-meny">Chicken fillet with tarragon sauce</p>
          <p>Vegansk bowl med tofu</p>
          <p class="eng-meny">Vegan bowl with tofu</p>
          <p>Fish and chips</p>
          <p class="eng-meny">Fish and chips</p>
          <h6>Tisdag</h6>
          <p>Köttbullar med potatismos</p>
          <p class="eng-meny">Meatballs with mashed potatoes</p>
          <p>Grönsakscurry med ris</p>
          <p class="eng-meny">Vegetable curry with rice</p>
          <p>Laxpasta med dill</p>
          <p class="eng-meny">Salmon pasta with dill</p>
        </div>
        <div id="next"><h2>Vecka 14</h2></div>
      </div>
    `);

    const currentSection = dom.window.document.querySelector("#current");
    const weekNumber = parser.extractWeekNumber(currentSection);
    const price = parser.extractPrice(currentSection);
    const lunches = parser.extractLunches(currentSection, weekNumber, price);

    expect(weekNumber).toBe(13);
    expect(price).toBe(135);
    expect(lunches).toHaveLength(6);

    expect(lunches[0]).toMatchObject({
      name: "Kycklingfilé med dragonsås",
      description: "Chicken fillet with tarragon sauce",
      price: 135,
      weekday: "måndag",
      week: 13,
      place: "Taste",
    });

    expect(lunches[3]).toMatchObject({
      name: "Köttbullar med potatismos",
      weekday: "tisdag",
      place: "Taste",
    });
  });

  it("extracts week number from section text", () => {
    const dom = new JSDOM(`<div id="s"><h2>Dagens lunch vecka 47</h2></div>`);
    const section = dom.window.document.querySelector("#s");
    expect(parser.extractWeekNumber(section)).toBe(47);
  });

  it("extracts week number case insensitive", () => {
    const dom = new JSDOM(`<div id="s"><p>Vecka 5</p></div>`);
    const section = dom.window.document.querySelector("#s");
    expect(parser.extractWeekNumber(section)).toBe(5);
  });

  it("falls back to current week when no week found", () => {
    const dom = new JSDOM(`<div id="s"><p>Lunchmeny</p></div>`);
    const section = dom.window.document.querySelector("#s");
    const week = parser.extractWeekNumber(section);
    expect(week).toBeGreaterThanOrEqual(1);
    expect(week).toBeLessThanOrEqual(53);
  });

  it("extracts price from text", () => {
    const dom = new JSDOM(`<div id="s"><p>Pris: 135kr</p></div>`);
    const section = dom.window.document.querySelector("#s");
    expect(parser.extractPrice(section)).toBe(135);
  });

  it("extracts price with space before kr", () => {
    const dom = new JSDOM(`<div id="s"><p>145 kr</p></div>`);
    const section = dom.window.document.querySelector("#s");
    expect(parser.extractPrice(section)).toBe(145);
  });

  it("falls back to 135 when no price found", () => {
    const dom = new JSDOM(`<div id="s"><p>Lunch</p></div>`);
    const section = dom.window.document.querySelector("#s");
    expect(parser.extractPrice(section)).toBe(135);
  });

  it("handles section with no h6 elements", () => {
    const dom = new JSDOM(`<div id="current"><p>No menu today</p></div>`);
    const section = dom.window.document.querySelector("#current");
    const lunches = parser.extractLunches(section, 13, 135);
    expect(lunches).toHaveLength(0);
  });

  it("skips h6 elements that are not weekdays", () => {
    const dom = new JSDOM(`
      <div id="current">
        <h6>Special</h6>
        <p>Something</p>
        <p class="eng-meny">Something in English</p>
        <h6>Måndag</h6>
        <p>Grillad lax</p>
        <p class="eng-meny">Grilled salmon</p>
      </div>
    `);

    const section = dom.window.document.querySelector("#current");
    const lunches = parser.extractLunches(section, 13, 135);
    expect(lunches).toHaveLength(1);
    expect(lunches[0].name).toBe("Grillad lax");
  });

  it("returns correct name and url", () => {
    expect(parser.getName()).toBe("Taste");
    expect(parser.getUrl()).toBe(
      "https://www.tastebynordrest.se/17/6/taste-malmo/",
    );
  });
});
