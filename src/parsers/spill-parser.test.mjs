import { beforeAll, describe, expect, it, beforeEach, vi } from "vitest";
import { SpillParser } from "./spill-parser.mjs";

function createParser() {
  const parser = new SpillParser();
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

describe("SpillParser", () => {
  let parser;

  beforeEach(() => {
    parser = createParser();
  });

  it("extracts Gängtappen menu with main and vegetarian dish", async () => {
    const dom = new JSDOM(`
      <div id="dagens">
        <div class="flex-1 flex flex-col gap-8 text-center">
          <h2 class="text-2xl">Gängtappen</h2>
          <h3>Dockan</h3>
          <div class="uppercase">fredag, 27/3, 2026</div>
          <div class="space-y-4">
            <div>Pulled pork burgare serveras med cheddar, karamelliserad lök, rostad majs, relish, tomat och coleslaw Vegetarisk: Portobello burgare</div>
          </div>
          <p>135kr</p>
        </div>
        <div class="flex-1 flex flex-col gap-8 text-center">
          <h2 class="text-2xl">Kvartetten</h2>
          <h3>Hyllie</h3>
          <div class="uppercase">fredag, 27/3, 2026</div>
          <div class="space-y-4">
            <div>Rostade rotfrukter med getostkräm och quinoa</div>
          </div>
          <p>135kr</p>
        </div>
      </div>
    `);

    const container = dom.window.document.querySelector("#dagens");
    const lunches = await parser.extractGangtappenMenu(container);

    expect(lunches).toHaveLength(2);
    expect(lunches[0]).toMatchObject({
      name: expect.stringContaining("Pulled pork burgare"),
      price: 135,
      weekday: "fredag",
      place: "Spill",
    });
    expect(lunches[1]).toMatchObject({
      name: expect.stringContaining("Portobello burgare"),
      price: 135,
      weekday: "fredag",
      place: "Spill",
    });
  });

  it("extracts correct week number from date", () => {
    const dom = new JSDOM(`
      <div>
        <div class="uppercase">måndag, 5/1, 2026</div>
        <div>Pasta med köttfärssås serveras med parmesan</div>
        <p>135kr</p>
      </div>
    `);
    const container = dom.window.document.querySelector("div");
    const { weekday, week } = parser.extractDateInfo(container);

    expect(weekday).toBe("måndag");
    expect(week).toBe(2);
  });

  it("extracts price from text", () => {
    const dom = new JSDOM(`<div><p>135kr</p></div>`);
    const container = dom.window.document.querySelector("div");
    expect(parser.extractPrice(container)).toBe(135);
  });

  it("extracts price with space before kr", () => {
    const dom = new JSDOM(`<div><p>145 kr</p></div>`);
    const container = dom.window.document.querySelector("div");
    expect(parser.extractPrice(container)).toBe(145);
  });

  it("splits main and vegetarian dishes", () => {
    const text =
      "Grillad kycklingfilé med ris och sås Vegetarisk: Halloumiburgare med sås";
    const { mainDish, vegetarianDish } = parser.parseMenuText(text);

    expect(mainDish).toContain("Grillad kycklingfilé");
    expect(vegetarianDish).toContain("Halloumiburgare");
  });

  it("handles menu without vegetarian option", () => {
    const text = "Vegansk bowl med tofu, edamame och sesamdressing";
    const { mainDish, vegetarianDish } = parser.parseMenuText(text);

    expect(mainDish).toContain("Vegansk bowl");
    expect(vegetarianDish).toBeNull();
  });

  it("returns empty when no Gängtappen section found", async () => {
    const dom = new JSDOM(`
      <div id="dagens">
        <div class="flex-1">
          <h2>Kvartetten</h2>
          <div class="uppercase">måndag, 5/1, 2026</div>
          <div>Some dish</div>
          <p>135kr</p>
        </div>
      </div>
    `);

    const container = dom.window.document.querySelector("#dagens");
    const lunches = await parser.extractGangtappenMenu(container);

    expect(lunches).toHaveLength(0);
  });
});
