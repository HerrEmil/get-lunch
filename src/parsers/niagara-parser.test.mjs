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
