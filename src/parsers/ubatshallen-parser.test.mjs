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

  it("extracts week number", () => {
    const dom = new JSDOM(`
      <div class="entry-content">
        <h2 class="wp-block-heading">Vecka 13</h2>
        <p>Måndag</p>
        <p>Det gröna: Pasta.Husman: Köttbullar.Internationell: Sushi.</p>
      </div>
    `);

    const lunches = parser.extractMenu(dom.window.document);
    expect(lunches[0].week).toBe(13);
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
});
