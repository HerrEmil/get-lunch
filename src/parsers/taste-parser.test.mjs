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

/**
 * Fixtures mirror the REAL castit-menus markup on
 * https://www.nordrest.se/restaurang/taste-by-nordrest-malmo/ as captured
 * live on 2026-07-02. Taste itself was on summer vacation at capture time
 * (single "SEMESTER STÄNGT ..." placeholder), so the populated-dish markup
 * was verified against a sibling Nordrest restaurant on the same template
 * the same day.
 */

// Real price/meta block rendered above the week panels.
const PRICE_META = `
  <div class="castit-weekly-top">
    <div class="castit-lunch-meta">
      <div class="castit-lunch-meta__block">
        <div class="castit-lunch-meta__label">
          <span class="castit-i18n" data-sv="PRISER" data-en="PRICES">PRISER</span>
        </div>
        <div class="castit-lunch-meta__items">
          <span class="castit-lunch-meta__item">
            <strong class="castit-i18n" data-sv="Nordrest kort" data-en="Nordrest kort">Nordrest kort</strong>: 125 SEK
          </span>
          <span class="castit-lunch-meta__item">
            <strong class="castit-i18n" data-sv="Lunchpris" data-en="Lunchpris">Lunchpris</strong>: 135 SEK
          </span>
        </div>
      </div>
    </div>
  </div>`;

function castitDish(name, desc) {
  return `
    <div class="castit-dish-wrap">
      <div class="castit-dish  ">
        <div class="castit-dish__left">
          <div class="castit-dish__title" data-sv="${name}" data-en="${name}">
            <span class="castit-i18n" data-sv="${name}" data-en="${name}">${name}</span>
          </div>
          ${
            desc
              ? `<div class="castit-dish__desc" data-sv="${desc}" data-en="${desc}">
            <span class="castit-i18n" data-sv="${desc}" data-en="${desc}">${desc}</span>
          </div>`
              : ""
          }
        </div>
        <div class="castit-dish__right"></div>
      </div>
    </div>`;
}

function castitDay(titleSv, dishes) {
  return `
    <section class="castit-day ">
      <h3 class="castit-day__title">
        <span class="castit-i18n" data-sv="${titleSv}" data-en="">${titleSv}</span>
      </h3>
      <div class="castit-day__list">${dishes.join("")}</div>
    </section>`;
}

function castitPanel({ week, index, menuId, days, active = false }) {
  return `
    <div class="castit-weekpanel${active ? " is-active" : ""}" data-week-panel="1" data-week="${week}" data-week-index="${index}" data-menu-id="${menuId}">
      <div class="castit-menu-grid castit-menu-grid--default">
        <div class="castit-menu-grid__days castit-menu-grid__days--default">
          ${days.join("")}
        </div>
      </div>
    </div>`;
}

function castitPage({ activeIndex = "0", panels, withPrices = true } = {}) {
  return `
    <div class="castit-lunch" data-castit-restaurant-id="40" data-active-week-index="${activeIndex}">
      ${withPrices ? PRICE_META : ""}
      <div class="castit-weekpanels" data-week-panels="1">
        ${panels.join("")}
      </div>
    </div>`;
}

// Fixture A: Taste's actual page as captured 2026-07-02 — vacation
// placeholder, one day, one "dish".
const VACATION_PAGE = castitPage({
  panels: [
    castitPanel({
      week: 27,
      index: "0",
      menuId: "1037",
      active: true,
      days: [
        castitDay("Måndag", [castitDish("SEMESTER STÄNGT ÖPPNAR IGEN 3/8")]),
      ],
    }),
  ],
});

// Fixture B: a populated week using dish markup verified on a sibling
// Nordrest restaurant (same plugin/template) 2026-07-02.
const POPULATED_PAGE = castitPage({
  panels: [
    castitPanel({
      week: 27,
      index: "0",
      menuId: "1037",
      active: true,
      days: [
        castitDay("Måndag", [
          castitDish(
            "Spaghetti med tomat",
            "chili och vitlök serveras med semitorkade tomater, cocktail mozzarella samt basilika",
          ),
          castitDish("Dagens vegetariska"),
        ]),
        castitDay("Tisdag", [
          castitDish("Köttbullar med potatismos", "serveras med lingon"),
        ]),
      ],
    }),
  ],
});

describe("TasteParser", () => {
  let parser;

  beforeEach(() => {
    parser = createParser();
  });

  it("returns correct name and url (new nordrest.se address)", () => {
    expect(parser.getName()).toBe("Taste");
    expect(parser.getUrl()).toBe(
      "https://www.nordrest.se/restaurang/taste-by-nordrest-malmo/",
    );
  });

  it("extracts lunches from a populated week panel", () => {
    const document = new JSDOM(POPULATED_PAGE).window.document;
    const panel = parser.findCurrentWeekPanel(document);
    const weekNumber = parser.extractWeekNumber(panel);
    const price = parser.extractLunchPrice(document);
    const lunches = parser.extractLunches(panel, weekNumber, price);

    expect(weekNumber).toBe(27);
    expect(lunches).toHaveLength(3);
    expect(lunches[0]).toMatchObject({
      name: "Spaghetti med tomat",
      description:
        "chili och vitlök serveras med semitorkade tomater, cocktail mozzarella samt basilika",
      price: 135,
      weekday: "måndag",
      week: 27,
      place: "Taste",
    });
    expect(lunches[2]).toMatchObject({
      name: "Köttbullar med potatismos",
      weekday: "tisdag",
      place: "Taste",
    });
  });

  it("treats the dish description as optional", () => {
    const document = new JSDOM(POPULATED_PAGE).window.document;
    const panel = parser.findCurrentWeekPanel(document);
    const lunches = parser.extractLunches(panel, 27);

    const noDesc = lunches.find((l) => l.name === "Dagens vegetariska");
    expect(noDesc).toBeDefined();
    expect(noDesc.description).toBe("");
  });

  it("extracts the Lunchpris (not the Nordrest kort price) from the meta block", () => {
    const document = new JSDOM(POPULATED_PAGE).window.document;
    expect(parser.extractLunchPrice(document)).toBe(135);
  });

  it("falls back to the default price when no meta block exists", () => {
    const document = new JSDOM(
      castitPage({ panels: [], withPrices: false }),
    ).window.document;
    expect(parser.extractLunchPrice(document)).toBe(135);
  });

  it("filters the vacation closure placeholder so a closed week yields 0 lunches", () => {
    const document = new JSDOM(VACATION_PAGE).window.document;
    const panel = parser.findCurrentWeekPanel(document);
    expect(panel).not.toBeNull();
    expect(parser.extractWeekNumber(panel)).toBe(27);

    const lunches = parser.extractLunches(panel, 27, 135);
    expect(lunches).toHaveLength(0);
  });

  it("falls back to the first populated panel when the active panel is empty", () => {
    // Verified on a sibling restaurant: active panel can be an empty
    // placeholder (data-menu-id="0", no dishes) while a later panel holds
    // the menu.
    const page = castitPage({
      activeIndex: "0",
      panels: [
        castitPanel({ week: 27, index: "0", menuId: "0", active: true, days: [] }),
        castitPanel({
          week: 33,
          index: "1",
          menuId: "1102",
          days: [castitDay("Måndag", [castitDish("Grillad lax", "med dill")])],
        }),
      ],
    });
    const document = new JSDOM(page).window.document;
    const panel = parser.findCurrentWeekPanel(document);
    expect(parser.extractWeekNumber(panel)).toBe(33);

    const lunches = parser.extractLunches(panel, 33, 135);
    expect(lunches).toHaveLength(1);
    expect(lunches[0].name).toBe("Grillad lax");
  });

  it("picks the active panel when it is populated", () => {
    const page = castitPage({
      activeIndex: "1",
      panels: [
        castitPanel({
          week: 26,
          index: "0",
          menuId: "1000",
          days: [castitDay("Måndag", [castitDish("Old dish")])],
        }),
        castitPanel({
          week: 27,
          index: "1",
          menuId: "1037",
          active: true,
          days: [castitDay("Måndag", [castitDish("Current dish")])],
        }),
      ],
    });
    const document = new JSDOM(page).window.document;
    const panel = parser.findCurrentWeekPanel(document);
    expect(parser.extractWeekNumber(panel)).toBe(27);
    expect(parser.extractLunches(panel, 27)[0].name).toBe("Current dish");
  });

  it("extracts week number from the data-week attribute", () => {
    const dom = new JSDOM(`<div data-week-panel="1" data-week="47"></div>`);
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
    const page = castitPage({
      panels: [
        castitPanel({
          week: 27,
          index: "0",
          menuId: "1037",
          active: true,
          days: [
            castitDay("Övrigt", [castitDish("Inget")]),
            castitDay("Fredag", [castitDish("Grillad lax", "med dill")]),
          ],
        }),
      ],
    });
    const document = new JSDOM(page).window.document;
    const panel = parser.findCurrentWeekPanel(document);
    const lunches = parser.extractLunches(panel, 27);
    expect(lunches).toHaveLength(1);
    expect(lunches[0].name).toBe("Grillad lax");
  });
});
