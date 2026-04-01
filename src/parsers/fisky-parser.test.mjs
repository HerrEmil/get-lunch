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

const SAMPLE_PDF_TEXT =
  "VECKANS LUNCH Vecka 13 145 kr inkl sallad & bröd " +
  "FISK MÅNDAG - TISDAG Pasta al tonno, kapris & ansjovis " +
  "ONSDAG - FREDAG Grillad lubb med ratatouille, aioli & smala pommes " +
  "KÖTT HELA VECKAN Festivalkorv med öllök, potatismos, sötstark senap & fiskys ketchup " +
  "VEG HELA VECKAN Gnocchi med tomatragu, parmesan & ruccola";

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

  it("extracts week number from text", () => {
    const lunches = parser.parseMenuText(SAMPLE_PDF_TEXT);
    expect(lunches[0].week).toBe(13);
  });

  it("extracts price from text", () => {
    const lunches = parser.parseMenuText(SAMPLE_PDF_TEXT);
    expect(lunches[0].price).toBe(145);
  });

  it("creates correct total number of lunches", () => {
    const lunches = parser.parseMenuText(SAMPLE_PDF_TEXT);
    // 2 fish mon-tue + 3 fish wed-fri + 5 meat + 5 veg = 15
    expect(lunches).toHaveLength(15);
  });

  it("creates 2 lunches for fish mon-tue dish", () => {
    const lunches = parser.parseMenuText(SAMPLE_PDF_TEXT);
    const fishMonTue = lunches.filter(
      (l) =>
        l.name.includes("Pasta al tonno") &&
        ["måndag", "tisdag"].includes(l.weekday),
    );
    expect(fishMonTue).toHaveLength(2);
  });

  it("creates 3 lunches for fish wed-fri dish", () => {
    const lunches = parser.parseMenuText(SAMPLE_PDF_TEXT);
    const fishWedFri = lunches.filter(
      (l) =>
        l.name.includes("Grillad lubb") &&
        ["onsdag", "torsdag", "fredag"].includes(l.weekday),
    );
    expect(fishWedFri).toHaveLength(3);
  });

  it("creates 5 lunches for meat dish", () => {
    const lunches = parser.parseMenuText(SAMPLE_PDF_TEXT);
    const meat = lunches.filter((l) => l.name.includes("Festivalkorv"));
    expect(meat).toHaveLength(5);
    expect(new Set(meat.map((l) => l.weekday))).toEqual(
      new Set(["måndag", "tisdag", "onsdag", "torsdag", "fredag"]),
    );
  });

  it("creates 5 vegetarian lunches for veg dish", () => {
    const lunches = parser.parseMenuText(SAMPLE_PDF_TEXT);
    const veg = lunches.filter((l) => l.dietary?.includes("vegetarian"));
    expect(veg).toHaveLength(5);
    expect(veg[0].name).toContain("Gnocchi");
    expect(new Set(veg.map((l) => l.weekday))).toEqual(
      new Set(["måndag", "tisdag", "onsdag", "torsdag", "fredag"]),
    );
  });

  it("sets place to Fisky Business", () => {
    const lunches = parser.parseMenuText(SAMPLE_PDF_TEXT);
    for (const lunch of lunches) {
      expect(lunch.place).toBe("Fisky Business");
    }
  });

  it("returns empty array for text with no menu items", () => {
    const lunches = parser.parseMenuText("Nothing here");
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
