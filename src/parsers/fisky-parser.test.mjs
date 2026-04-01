import { describe, expect, it, beforeEach } from "vitest";
import { FiskyParser } from "./fisky-parser.mjs";

function createParser() {
  const parser = new FiskyParser();
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

// Positioned text items matching real pdfjs output from Fisky Business PDF.
// Two-column layout: left (x≈38) and right (x≈340).
const SAMPLE_ITEMS = [
  { text: "LUNCH", x: 35, y: 629 },
  { text: "Vecka 13", x: 444, y: 74 },
  { text: "145 kr inkl sallad & bröd", x: 285, y: 41 },
  { text: "FISK", x: 250, y: 550 },
  // Left column: MÅNDAG-TISDAG fish, then KÖTT meat
  { text: "MÅNDAG -", x: 38, y: 489 },
  { text: "TISDAG", x: 38, y: 449 },
  { text: "Pasta al tonno, kapris", x: 38, y: 412 },
  { text: "& ansjovis", x: 38, y: 389 },
  { text: "KÖTT", x: 38, y: 278 },
  { text: "HELA VECKAN", x: 166, y: 278 },
  { text: "Festivalkorv med öllök,", x: 38, y: 236 },
  { text: "potatismos, sötstark", x: 38, y: 213 },
  { text: "senap & fiskys ketchup", x: 38, y: 190 },
  // Right column: ONSDAG-FREDAG fish, then VEG
  { text: "ONSDAG -", x: 342, y: 489 },
  { text: "FREDAG", x: 342, y: 449 },
  { text: "Grillad lubb med", x: 341, y: 412 },
  { text: "ratatouille, aioli &", x: 341, y: 389 },
  { text: "smala pommes", x: 341, y: 366 },
  { text: "VEG", x: 339, y: 278 },
  { text: "HELA VECKAN", x: 441, y: 280 },
  { text: "Gnocchi med", x: 339, y: 238 },
  { text: "tomatragu, parmesan", x: 339, y: 215 },
  { text: "& ruccola", x: 339, y: 192 },
];

describe("FiskyParser", () => {
  let parser;

  beforeEach(() => {
    parser = createParser();
  });

  it("has correct name and url", () => {
    expect(parser.getName()).toBe("Fisky Business");
    expect(parser.getUrl()).toBe(
      "https://fiskybusiness.nu/dockan-malmouml.html",
    );
  });

  it("extracts week number", () => {
    const lunches = parser.parsePdfItems(SAMPLE_ITEMS);
    expect(lunches[0].week).toBe(13);
  });

  it("extracts price", () => {
    const lunches = parser.parsePdfItems(SAMPLE_ITEMS);
    expect(lunches[0].price).toBe(145);
  });

  it("creates correct total number of lunches", () => {
    const lunches = parser.parsePdfItems(SAMPLE_ITEMS);
    // 2 fish mon-tue + 3 fish wed-fri + 5 meat + 5 veg = 15
    expect(lunches).toHaveLength(15);
  });

  it("creates 2 lunches for fish mon-tue dish", () => {
    const lunches = parser.parsePdfItems(SAMPLE_ITEMS);
    const fishMonTue = lunches.filter(
      (l) =>
        l.name.includes("Pasta al tonno") &&
        ["måndag", "tisdag"].includes(l.weekday),
    );
    expect(fishMonTue).toHaveLength(2);
  });

  it("creates 3 lunches for fish wed-fri dish", () => {
    const lunches = parser.parsePdfItems(SAMPLE_ITEMS);
    const fishWedFri = lunches.filter(
      (l) =>
        l.name.includes("Grillad lubb") &&
        ["onsdag", "torsdag", "fredag"].includes(l.weekday),
    );
    expect(fishWedFri).toHaveLength(3);
  });

  it("creates 5 lunches for meat dish", () => {
    const lunches = parser.parsePdfItems(SAMPLE_ITEMS);
    const meat = lunches.filter((l) => l.name.includes("Festivalkorv"));
    expect(meat).toHaveLength(5);
    expect(new Set(meat.map((l) => l.weekday))).toEqual(
      new Set(["måndag", "tisdag", "onsdag", "torsdag", "fredag"]),
    );
  });

  it("creates 5 vegetarian lunches for veg dish", () => {
    const lunches = parser.parsePdfItems(SAMPLE_ITEMS);
    const veg = lunches.filter((l) => l.dietary?.includes("vegetarian"));
    expect(veg).toHaveLength(5);
    expect(veg[0].name).toContain("Gnocchi");
  });

  it("sets place to Fisky Business", () => {
    const lunches = parser.parsePdfItems(SAMPLE_ITEMS);
    for (const lunch of lunches) {
      expect(lunch.place).toBe("Fisky Business");
    }
  });

  it("returns empty array when no price found", () => {
    const lunches = parser.parsePdfItems([
      { text: "Nothing here", x: 0, y: 0 },
    ]);
    expect(lunches).toHaveLength(0);
  });

  it("finds PDF URL from HTML", async () => {
    const mockHtml = `
      <html><body>
        <a href="/about">Om oss</a>
        <a href="/uploads/1/4/4/1/144194274/lunchmeny_v_13.pdf">lunch vecka 13</a>
      </body></html>
    `;

    parser.fetchDocument = async () => {
      const { JSDOM } = await import("jsdom");
      return new JSDOM(mockHtml).window.document;
    };

    const url = await parser.findPdfUrl();
    expect(url).toBe(
      "https://fiskybusiness.nu/uploads/1/4/4/1/144194274/lunchmeny_v_13.pdf",
    );
  });

  it("returns null when no lunch vecka link found", async () => {
    const mockHtml = `<html><body><a href="/about">Om oss</a></body></html>`;

    parser.fetchDocument = async () => {
      const { JSDOM } = await import("jsdom");
      return new JSDOM(mockHtml).window.document;
    };

    const url = await parser.findPdfUrl();
    expect(url).toBeNull();
  });
});
