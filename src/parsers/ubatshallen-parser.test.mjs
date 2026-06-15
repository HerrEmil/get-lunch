import { beforeAll, describe, expect, it, beforeEach, vi } from "vitest";
import { UbatshallenParser } from "./ubatshallen-parser.mjs";

function createParser() {
  const parser = new UbatshallenParser();
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

describe("UbatshallenParser", () => {
  let parser;

  beforeEach(() => {
    parser = createParser();
  });

  it("has correct name and url", () => {
    expect(parser.getName()).toBe("Ubåtshallen");
    expect(parser.getUrl()).toBe("https://www.ubatshallen.se/");
  });

  it("extracts dishes from concatenated category format", () => {
    const dom = new JSDOM(`
      <div class="entry-content">
        <h2 class="wp-block-heading">Vecka 14</h2>
        <p>Måndag</p>
        <p>Det gröna: Tortellini med ricotta.Husman: Kycklinggryta med ris.Internationell: Pad thai med tofu.</p>
        <p>Tisdag</p>
        <p>Det gröna: Vegoburgare.Husman: Pannbiff med potatis.Internationell: Tacos.</p>
      </div>
    `);

    const lunches = parser.extractMenu(dom.window.document);

    expect(lunches.length).toBe(6);

    const monday = lunches.filter((l) => l.weekday === "måndag");
    expect(monday.length).toBe(3);
    expect(monday[0].name).toBe("Det gröna");
    expect(monday[0].description).toContain("Tortellini");
    expect(monday[1].name).toBe("Husman");
    expect(monday[2].name).toBe("Internationell");

    const tuesday = lunches.filter((l) => l.weekday === "tisdag");
    expect(tuesday.length).toBe(3);
    expect(tuesday[0].description).toContain("Vegoburgare");
  });

  it("uses current week regardless of site week number", () => {
    const dom = new JSDOM(`
      <div class="entry-content">
        <h2 class="wp-block-heading">Vecka 99</h2>
        <p>Måndag</p>
        <p>Det gröna: Pasta.Husman: Köttbullar.Internationell: Sushi.</p>
      </div>
    `);

    const lunches = parser.extractMenu(dom.window.document);
    expect(lunches[0].week).toBe(parser._getCurrentWeek());
  });

  it("skips closed days", () => {
    const dom = new JSDOM(`
      <div class="entry-content">
        <h2 class="wp-block-heading">Vecka 14</h2>
        <p>Fredag – STÄNGT</p>
        <p>Det gröna: Husman: Internationell:</p>
      </div>
    `);

    const lunches = parser.extractMenu(dom.window.document);
    expect(lunches.length).toBe(0);
  });

  it("extracts a weekday whose label is glued to the previous day's dishes", () => {
    // Source frequently appends the next day's label to the end of the prior
    // day's dish paragraph, e.g. "...sötsur såsOnsdag" with no separate header.
    const dom = new JSDOM(`
      <div class="entry-content">
        <p>Tisdag</p>
        <p>Det gröna: Vetekornsotto.Husman: Spättafile.Internationell: Sticky chickenOnsdag</p>
        <p>Det gröna: MajsFritters.Husman: Pytt i panna.Internationell: Boeuf bourguignon.</p>
      </div>
    `);

    const lunches = parser.extractMenu(dom.window.document);

    const onsdag = lunches.filter((l) => l.weekday === "onsdag");
    expect(onsdag.length).toBe(3);
    expect(onsdag[0].name).toBe("Det gröna");
    expect(onsdag[0].description).toContain("MajsFritters");
    expect(onsdag[2].description).toContain("Boeuf bourguignon");

    // Tuesday's Internationell must not be polluted by the trailing "Onsdag".
    const tuesdayIntl = lunches.find(
      (l) => l.weekday === "tisdag" && l.name === "Internationell",
    );
    expect(tuesdayIntl.description).toBe("Sticky chicken");
  });

  it("does not emit duplicate weekday+category entries when a closed day is inlined after another day's dishes", () => {
    // Real Midsummer week: Torsdag's dishes are immediately followed, in the
    // same paragraph, by an inlined closed Fredag. The old parser leaked the
    // Fredag closure text into torsdag, producing duplicate "Det gröna" rows.
    const dom = new JSDOM(`
      <div class="entry-content">
        <p>Torsdag</p>
        <p>Det gröna: Bibimbap sojafärs.Husman: Raggmunkar.Internationell: Bibimbap nötfärs Fredag Det gröna: Husman: STÄNGT — GLAD MIDSOMMAR — STÄNGTInternationell: ( Vi är tillbaka Måndag 22 Juni)</p>
      </div>
    `);

    const lunches = parser.extractMenu(dom.window.document);

    // No duplicate weekday+category combinations.
    const keys = lunches.map((l) => `${l.weekday}|${l.name}`);
    expect(new Set(keys).size).toBe(keys.length);

    // Torsdag gets exactly its three real dishes.
    const torsdag = lunches.filter((l) => l.weekday === "torsdag");
    expect(torsdag.length).toBe(3);
    expect(torsdag.map((l) => l.name)).toEqual([
      "Det gröna",
      "Husman",
      "Internationell",
    ]);
    expect(
      torsdag.find((l) => l.name === "Internationell").description,
    ).toBe("Bibimbap nötfärs");

    // Fredag is closed (STÄNGT) and must not appear at all.
    expect(lunches.filter((l) => l.weekday === "fredag").length).toBe(0);
  });

  it("extracts a full Mon-Thu week with no duplicates (Midsummer-week shape)", () => {
    const dom = new JSDOM(`
      <div class="entry-content">
        <p>15 Juni till 19 Juni</p>
        <p>Måndag</p>
        <p>Det gröna: M1.Husman: M2.Internationell: M3.</p>
        <p>Tisdag</p>
        <p>Det gröna: T1.Husman: T2.Internationell: T3Onsdag</p>
        <p>Det gröna: O1.Husman: O2.Internationell: O3.</p>
        <p>Torsdag</p>
        <p>Det gröna: To1.Husman: To2.Internationell: To3 Fredag Det gröna: Husman: STÄNGT — GLAD MIDSOMMAR — STÄNGTInternationell: ( tillbaka Måndag 22 Juni)</p>
        <p>Dagens Lunch 129,-</p>
      </div>
    `);

    const lunches = parser.extractMenu(dom.window.document);

    expect(lunches.length).toBe(12);
    const days = [...new Set(lunches.map((l) => l.weekday))];
    expect(days).toEqual(["måndag", "tisdag", "onsdag", "torsdag"]);

    const keys = lunches.map((l) => `${l.weekday}|${l.name}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
