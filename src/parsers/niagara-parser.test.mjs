import { beforeAll, describe, expect, it, beforeEach, vi } from "vitest";
import { NiagaraParser } from "./niagara-parser.mjs";

function createParser() {
  const parser = new NiagaraParser();
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

describe("NiagaraParser modern layout handling", () => {
  let parser;

  beforeEach(() => {
    parser = createParser();
  });

  it("extracts week number from extended date format", () => {
    const dom = new JSDOM(`
      <section>
        <h3>Vecka 20250714</h3>
      </section>
    `);
    const container = dom.window.document.querySelector("section");

    const week = parser.extractWeekNumber(container);

    expect(week).toBe(29);
  });

  it("parses lunches from tabbed panels", async () => {
    const dom = new JSDOM(`
      <section class="lunch-section">
        <h2>Vår lunchmeny</h2>
        <h3>Vecka 20250714</h3>
        <div role="tablist">
          <button id="tab-monday" role="tab" aria-controls="monday">Måndag</button>
          <button id="tab-tuesday" role="tab" aria-controls="tuesday">Tisdag</button>
        </div>
        <div id="monday" role="tabpanel" aria-labelledby="tab-monday" data-day="måndag">
          <article class="menu-item">
            <div class="meal-title">Grillad lax</div>
            <div class="description">Med potatis</div>
            <span class="price">145 kr</span>
          </article>
        </div>
        <div id="tuesday" role="tabpanel" aria-labelledby="tab-tuesday" data-weekday="tisdag">
          <div class="menu-item">
            <h5>Vegobowl</h5>
            <span class="price">120:-</span>
          </div>
        </div>
      </section>
    `);

    const container = dom.window.document.querySelector("section");
    const lunches = await parser.extractFromModernStructure(container);

    expect(lunches).toHaveLength(2);
    const monday = lunches.find((lunch) => lunch.weekday === "måndag");
    const tuesday = lunches.find((lunch) => lunch.weekday === "tisdag");

    expect(monday).toMatchObject({
      name: "Grillad lax",
      description: "Med potatis",
      price: 145,
      week: 29,
    });
    expect(tuesday).toMatchObject({
      name: "Vegobowl",
      price: 120,
      week: 29,
    });
  });

  it("uses dish description as name when heading is a category", async () => {
    const dom = new JSDOM(`
      <section class="lunch-section">
        <h3>Vecka 20250714</h3>
        <div role="tabpanel" data-day="måndag">
          <div class="lunchmeny_container">
            <span class="lunch_title">Green</span>
            <span class="lunch_price">115:-</span>
            <div class="lunch_desc">Frittata på champinjoner, paprika &amp; potatis, ruccola- &amp; tomatsallad, parmesan</div>
          </div>
          <div class="lunchmeny_container">
            <span class="lunch_title">Local</span>
            <span class="lunch_price">115:-</span>
            <div class="lunch_desc">Stekt strömming med potatismos och lingon</div>
          </div>
        </div>
      </section>
    `);

    const container = dom.window.document.querySelector("section");
    const lunches = await parser.extractFromModernStructure(container);

    expect(lunches.length).toBeGreaterThanOrEqual(2);
    const green = lunches.find((l) => l.name === "Green");
    const local = lunches.find((l) => l.name === "Local");

    expect(green).toBeDefined();
    expect(green.description).toContain("Frittata");
    expect(green.price).toBe(115);

    expect(local).toBeDefined();
    expect(local.description).toContain("strömming");
  });

  it("returns no items when the page shows a vacation notice instead of a menu", async () => {
    // Real markup observed 2026-07-17 (week 29): the closure notice occupies the
    // same .lunchmeny_container slot a dish would, with an empty .lunch_price.
    // The digits in "V.29-32" previously leaked out as a 0.29 kr "dish".
    const dom = new JSDOM(`
      <section class="lunch-section">
        <h3>Vecka 20250714</h3>
        <div id="e-n-tab-content-2115517941" role="tabpanel" aria-labelledby="monday-tab">
          <div class="elementor-element monday">
            <h3 class="elementor-heading-title">Måndag</h3>
            <div class="elementor-shortcode">
              <div class="lunchmeny_wrapper">
                <div class="lunchmeny_container">
                  <span class="lunch_icon"><svg viewBox="0 0 512 512"><path d="M361.5 1.2z"/></svg></span>
                  <span class="lunch_title">Semesterstängt V.29-32</span>
                  <span class="lunch_separator"></span>
                  <span class="lunch_price"></span>
                  <div class="lunch_desc">Vi på restaurang Niagara önskar er en glad sommar! 😎⛱️
Vi är återigen måndagen den 10 Augusti.
Hälsningar från Personalen!
</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    `);

    const container = dom.window.document.querySelector("section");
    const lunches = await parser.extractFromModernStructure(container);

    expect(lunches).toHaveLength(0);
  });

  it("detects closure messaging when no lunches exist", async () => {
    const dom = new JSDOM(`
      <section>
        <h3>Vecka 20250714</h3>
        <p>Semesterstängt V.29-32</p>
      </section>
    `);

    const container = dom.window.document.querySelector("section");
    const lunches = await parser.extractFromModernStructure(container);
    const closure = parser.checkIfRestaurantClosed(container);

    expect(lunches).toHaveLength(0);
    expect(closure.isClosed).toBe(true);
    expect(closure.reason).toContain("semester");
  });
});
