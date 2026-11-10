import { describe, expect, it, beforeEach } from "vitest";
import { Lokal12Parser } from "./lokal12-parser.mjs";

function createParser() {
  const parser = new Lokal12Parser();
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

// Lines as reconstructed from the real week 46 PDF
const SAMPLE_LINES = [
  "MENY VECKA 46",
  "KLASSISK 145 kr",
  "Måndag | KÖTTBULLERIA",
  "Köttbullar-potatismos-lingon-gurka-",
  "gräddsås",
  "Meat balls-mashed potato-lingonberry-",
  "cucumber-gravy",
  "Tisdag | VÄRLDENS MAT",
  "Marinerade nudlar-kyckling-rödkål-chili",
  "Marinated noodles-chicken-red cabbage-",
  "chili",
  "Onsdag | HUSMANSKOST",
  "Stekt fläsk-raggmunk-lingon",
  "Fried pork-potato pancake-lingonberries",
  "Torsdag | SCHNITZEL",
  "Schnitzel-senapspotatis-bönor-kaprissmör",
  "grillad citron",
  "Schnitzel-mustard potato-beans-caper",
  "butter-grilled lemon",
  "Fredag | GRILLBUFFÉ",
  "Grillbuffé",
  "Alla dagar inkluderas:",
  "Soppa, grönsaker med världen som",
  "VECKANS VEGETARISKA 150 kr",
  "Svamprisotto-brysselkål-mozzarella-riven",
  "ost",
  "Mushroom risotto Brussels sprouts-",
  "mozzarella-grated cheese",
  "ALLTID HOS LOKAL 12",
  "Always on the menu",
  "Halstrad råbiff – rödbetor – picklad",
  "185 kr",
  "VIN",
  "Blanc 115kr/495kr",
];

const item = (str, y) => ({ str, transform: [1, 0, 0, 1, 78, y] });

describe("Lokal12Parser", () => {
  let parser;

  beforeEach(() => {
    parser = createParser();
  });

  it("has correct name and url", () => {
    expect(parser.getName()).toBe("Lokal 12");
    expect(parser.getUrl()).toBe("https://lokal12.se/");
  });

  it("extracts one Swedish dish per weekday with week and price", () => {
    const daily = parser.parseMenuLines(SAMPLE_LINES).filter((l) => !l.dietary);

    expect(daily.map((l) => [l.weekday, l.name])).toEqual([
      ["måndag", "Köttbullar-potatismos-lingon-gurka-gräddsås"],
      ["tisdag", "Marinerade nudlar-kyckling-rödkål-chili"],
      ["onsdag", "Stekt fläsk-raggmunk-lingon"],
      ["torsdag", "Schnitzel-senapspotatis-bönor-kaprissmör grillad citron"],
      ["fredag", "Grillbuffé"],
    ]);
    expect(daily.every((l) => l.price === 145 && l.week === 46 && l.place === "Lokal 12")).toBe(true);
  });

  it("repeats the weekly vegetarian dish on every served day", () => {
    const vegetarian = parser.parseMenuLines(SAMPLE_LINES).filter((l) => l.dietary);

    expect(vegetarian.map((l) => l.weekday)).toEqual(["måndag", "tisdag", "onsdag", "torsdag", "fredag"]);
    for (const lunch of vegetarian) {
      expect(lunch.name).toBe("Svamprisotto-brysselkål-mozzarella-riven ost");
      expect(lunch.price).toBe(150);
      expect(lunch.dietary).toEqual(["vegetarian"]);
    }
  });

  it("excludes the always-on menu and drinks", () => {
    const names = parser.parseMenuLines(SAMPLE_LINES).map((l) => l.name).join(" ");
    expect(names).not.toMatch(/råbiff|Blanc|Soppa/);
  });

  it("skips closed days, including their vegetarian dish", () => {
    const lines = SAMPLE_LINES.map((line) => (line === "Grillbuffé" ? "Stängt" : line));
    const lunches = parser.parseMenuLines(lines);

    expect(lunches.some((l) => l.weekday === "fredag")).toBe(false);
    expect(lunches).toHaveLength(8);
  });

  it("rebuilds lines and joins words split around ligatures", () => {
    const lines = parser.itemsToLines([
      item("Fredag |", 217),
      item(" ", 217),
      item("GRILLBUFFÉ", 217),
      item("Grillbu", 201),
      item("ff", 201),
      item("é", 201),
    ]);

    expect(lines).toEqual(["Fredag | GRILLBUFFÉ", "Grillbuffé"]);
  });

  it("finds the PDF behind the Lunchmeny button", async () => {
    parser.fetchDocument = async () => ({
      querySelectorAll: () => [
        { textContent: "Boka bord", getAttribute: () => "https://book.easytable.com/" },
        { textContent: "Lunchmeny", getAttribute: () => "/wp-content/uploads/2026/11/lokal12-lunchmeny-v-46.pdf" },
      ],
    });

    await expect(parser.findPdfUrl()).resolves.toBe(
      "https://lokal12.se/wp-content/uploads/2026/11/lokal12-lunchmeny-v-46.pdf",
    );
  });

  it("returns no lunches when the menu has no sections", () => {
    expect(parser.parseMenuLines(["Semesterstängt"])).toEqual([]);
  });
});
