import { describe, expect, it, beforeEach } from "vitest";
import { Lokal17Parser } from "./lokal17-parser.mjs";

function createParser() {
  const parser = new Lokal17Parser();
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

// Sample PDF text matching the real Lokal 17 format
const SAMPLE_PDF_TEXT =
  "LUNCH VECKA 14 " +
  "Måndag/Monday 150kr " +
  "Kycklingfärsbiff-currysås-vinbär-ris " +
  "Chicken patty-curry sauce-black currant-rice " +
  "Tisdag/Tuesday 150kr " +
  "Cevapcici-tzatziki-paprika-majs " +
  "Cevapcici-tzatziki-bell pepper-corn " +
  "Onsdag/Wednesday 150kr " +
  "Fläskrullad-senap-broccoli-potatisgratäng " +
  "Pork-mustard-broccoli-potato gratin " +
  "Torsdag/Thursday 150kr " +
  "Kyckling-äppelcidersås-blomkålspuré-purjolök " +
  "Chicken-apple cider sauce-cauliflower purée-leek " +
  "Vegetarisk/Vegetarian 150kr " +
  "Tortilla-falafel-hummus-tomat-saltgurka-persilja " +
  "Tortilla-falafel-hummus-tomato-pickle-parsley " +
  "Alltid hos Lokal 17";

describe("Lokal17Parser", () => {
  let parser;

  beforeEach(() => {
    parser = createParser();
  });

  it("has correct name and url", () => {
    expect(parser.getName()).toBe("Lokal 17");
    expect(parser.getUrl()).toBe("https://lokal17.se/");
  });

  it("parses menu text into lunch objects", () => {
    const lunches = parser.parseMenuText(SAMPLE_PDF_TEXT);

    // 4 daily dishes + 4 vegetarian (one per weekday that has a daily dish)
    expect(lunches).toHaveLength(8);

    // Check Monday dish
    const monday = lunches.find(
      (l) => l.weekday === "måndag" && !l.dietary?.includes("vegetarian"),
    );
    expect(monday).toMatchObject({
      name: expect.stringContaining("Kycklingfärsbiff"),
      price: 150,
      weekday: "måndag",
      week: 14,
      place: "Lokal 17",
    });

    // Check Tuesday
    const tuesday = lunches.find(
      (l) => l.weekday === "tisdag" && !l.dietary?.includes("vegetarian"),
    );
    expect(tuesday).toMatchObject({
      name: expect.stringContaining("Cevapcici"),
      price: 150,
    });

    // Check Wednesday
    const wednesday = lunches.find(
      (l) => l.weekday === "onsdag" && !l.dietary?.includes("vegetarian"),
    );
    expect(wednesday).toMatchObject({
      name: expect.stringContaining("Fläskrullad"),
      price: 150,
    });

    // Check Thursday
    const thursday = lunches.find(
      (l) => l.weekday === "torsdag" && !l.dietary?.includes("vegetarian"),
    );
    expect(thursday).toMatchObject({
      name: expect.stringContaining("Kyckling"),
      price: 150,
    });

    // Check vegetarian dishes exist for all weekdays with daily dishes
    const vegLunches = lunches.filter((l) =>
      l.dietary?.includes("vegetarian"),
    );
    expect(vegLunches).toHaveLength(4);
    expect(vegLunches[0].name).toContain("Tortilla");
    expect(new Set(vegLunches.map((l) => l.weekday))).toEqual(
      new Set(["måndag", "tisdag", "onsdag", "torsdag"]),
    );
  });

  it("extracts week number from text", () => {
    const lunches = parser.parseMenuText(SAMPLE_PDF_TEXT);
    expect(lunches[0].week).toBe(14);
  });

  it("does not include English translations in dish names", () => {
    const lunches = parser.parseMenuText(SAMPLE_PDF_TEXT);
    for (const lunch of lunches) {
      expect(lunch.name).not.toMatch(/Chicken/);
      expect(lunch.name).not.toMatch(/Pork/);
      expect(lunch.name).not.toMatch(/Tortilla-falafel-hummus-tomato/);
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
        <a href="https://lokal17.se/app/uploads/sites/2/2026/03/Lunchmeny-v.14.pdf">Lunchmeny</a>
      </body></html>
    `;

    parser.fetchDocument = async () => {
      const { JSDOM } = await import("jsdom");
      return new JSDOM(mockHtml).window.document;
    };

    const url = await parser.findPdfUrl();
    expect(url).toBe(
      "https://lokal17.se/app/uploads/sites/2/2026/03/Lunchmeny-v.14.pdf",
    );
  });

  it("returns null when no Lunchmeny link found", async () => {
    const mockHtml = `<html><body><a href="/about">Om oss</a></body></html>`;

    parser.fetchDocument = async () => {
      const { JSDOM } = await import("jsdom");
      return new JSDOM(mockHtml).window.document;
    };

    const url = await parser.findPdfUrl();
    expect(url).toBeNull();
  });
});
