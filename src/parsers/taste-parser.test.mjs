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

/** Mirrors the castit-menus plugin markup: week panel -> days -> dishes. */
function castitDish(name, desc) {
  return `
    <div class="castit-dish">
      <div class="castit-dish__left">
        <div class="castit-dish__title"><span class="castit-i18n">${name}</span></div>
        <div class="castit-dish__desc"><span class="castit-i18n">${desc}</span></div>
      </div>
      <div class="castit-dish__right"></div>
    </div>`;
}

function castitDay(title, dishes) {
  return `
    <div class="castit-day">
      <h3 class="castit-day__title">${title}</h3>
      <div class="castit-day__list">${dishes.join("")}</div>
    </div>`;
}

function castitPage({ week = 21, index = "0", activeIndex = "0", days } = {}) {
  return `
    <div data-active-week-index="${activeIndex}">
      <div data-week-panel="1" data-week="${week}" data-week-index="${index}">
        <div class="castit-lunch-header">Lunch v. ${week}</div>
        ${days
          .map((d) => castitDay(d.title, d.dishes.map((x) => castitDish(x.name, x.desc))))
          .join("")}
      </div>
    </div>`;
}

describe("TasteParser", () => {
  let parser;

  beforeEach(() => {
    parser = createParser();
  });

  it("extracts lunches from the active castit week panel", () => {
    const dom = new JSDOM(
      castitPage({
        week: 21,
        days: [
          {
            title: "Måndag",
            dishes: [
              { name: "Kycklingfilé med dragonsås", desc: "Serveras med ris" },
              { name: "Vegansk bowl med tofu", desc: "Med chilikräm" },
            ],
          },
          {
            title: "Tisdag",
            dishes: [
              { name: "Köttbullar med potatismos", desc: "Med lingon" },
            ],
          },
        ],
      }),
    );
    const document = dom.window.document;
    const panel = parser.findCurrentWeekPanel(document);
    const weekNumber = parser.extractWeekNumber(panel);
    const lunches = parser.extractLunches(panel, weekNumber);

    expect(weekNumber).toBe(21);
    expect(lunches).toHaveLength(3);
    expect(lunches[0]).toMatchObject({
      name: "Kycklingfilé med dragonsås",
      description: "Serveras med ris",
      price: 135,
      weekday: "måndag",
      week: 21,
      place: "Taste",
    });
    expect(lunches[2]).toMatchObject({
      name: "Köttbullar med potatismos",
      weekday: "tisdag",
      place: "Taste",
    });
  });

  it("matches a day title that carries extra text (e.g. an 'Idag' badge)", () => {
    const dom = new JSDOM(
      castitPage({
        week: 21,
        days: [
          {
            title: "Onsdag <span>Idag</span>",
            dishes: [{ name: "Champinjoncrepes", desc: "Med spenat" }],
          },
        ],
      }),
    );
    const panel = parser.findCurrentWeekPanel(dom.window.document);
    const lunches = parser.extractLunches(panel, 21);
    expect(lunches).toHaveLength(1);
    expect(lunches[0].weekday).toBe("onsdag");
  });

  it("picks the panel matching the active week index", () => {
    const dom = new JSDOM(`
      <div data-active-week-index="1">
        <div data-week-panel="1" data-week="20" data-week-index="0">
          ${castitDay("Måndag", [castitDish("Old dish", "")])}
        </div>
        <div data-week-panel="1" data-week="21" data-week-index="1">
          ${castitDay("Måndag", [castitDish("Current dish", "")])}
        </div>
      </div>
    `);
    const panel = parser.findCurrentWeekPanel(dom.window.document);
    expect(parser.extractWeekNumber(panel)).toBe(21);
    expect(parser.extractLunches(panel, 21)[0].name).toBe("Current dish");
  });

  it("extracts week number from the data-week attribute", () => {
    const dom = new JSDOM(
      `<div data-week-panel="1" data-week="47"></div>`,
    );
    const panel = dom.window.document.querySelector("[data-week-panel]");
    expect(parser.extractWeekNumber(panel)).toBe(47);
  });

  it("falls back to current week when data-week is missing", () => {
    const dom = new JSDOM(`<div data-week-panel="1"></div>`);
    const panel = dom.window.document.querySelector("[data-week-panel]");
    const week = parser.extractWeekNumber(panel);
    expect(week).toBeGreaterThanOrEqual(1);
    expect(week).toBeLessThanOrEqual(53);
  });

  it("returns null when no week panel is present", () => {
    const dom = new JSDOM(`<div><p>No menu</p></div>`);
    expect(parser.findCurrentWeekPanel(dom.window.document)).toBeNull();
  });

  it("returns no lunches for a panel with no castit-day blocks", () => {
    const dom = new JSDOM(`<div data-week-panel="1" data-week="21"></div>`);
    const panel = dom.window.document.querySelector("[data-week-panel]");
    expect(parser.extractLunches(panel, 21)).toHaveLength(0);
  });

  it("skips day blocks whose title is not a weekday", () => {
    const dom = new JSDOM(
      castitPage({
        week: 21,
        days: [
          { title: "Stängt", dishes: [{ name: "Inget", desc: "" }] },
          { title: "Fredag", dishes: [{ name: "Grillad lax", desc: "Med dill" }] },
        ],
      }),
    );
    const panel = parser.findCurrentWeekPanel(dom.window.document);
    const lunches = parser.extractLunches(panel, 21);
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
