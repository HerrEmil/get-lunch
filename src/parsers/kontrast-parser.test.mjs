import { describe, expect, it, beforeEach, vi } from "vitest";
import { KontrastParser } from "./kontrast-parser.mjs";

function createParser() {
  const parser = new KontrastParser();
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

describe("KontrastParser", () => {
  let parser;

  beforeEach(() => {
    parser = createParser();
  });

  it("has correct name and url", () => {
    expect(parser.getName()).toBe("Kontrast");
    expect(parser.getUrl()).toContain("kontrastrestaurang.se");
  });

  it("parses menu from API responses", async () => {
    const mockMenus = [
      { id: 1, date: "2026-03-30", location: "vastrahamnen", price: 119, isActive: true },
      { id: 2, date: "2026-03-31", location: "vastrahamnen", price: 119, isActive: true },
      { id: 3, date: "2026-03-30", location: "mollevangstorget", price: 99, isActive: true },
    ];
    const mockCategories = [
      { id: 1, nameSv: "Kött" },
      { id: 2, nameSv: "Kyckling" },
      { id: 3, nameSv: "Vegetariskt" },
    ];
    const mockDishesMenu1 = [
      { nameSv: "Butter Chicken", descriptionSv: "Tomat, yoghurt, smör", categoryId: 2 },
      { nameSv: "Daal Makhni", descriptionSv: "Svarta linser", categoryId: 3 },
    ];
    const mockDishesMenu2 = [
      { nameSv: "Ginger Beef", descriptionSv: "Ingefära, lök", categoryId: 1 },
    ];

    let fetchCount = 0;
    parser.makeRequest = async (url) => {
      fetchCount++;
      if (url.includes("/api/daily-menus/1/dishes")) return { json: async () => mockDishesMenu1 };
      if (url.includes("/api/daily-menus/2/dishes")) return { json: async () => mockDishesMenu2 };
      if (url.includes("/api/daily-menus")) return { json: async () => mockMenus };
      if (url.includes("/api/lunch-categories")) return { json: async () => mockCategories };
      return { json: async () => [] };
    };

    const lunches = await parser.parseMenu();

    // Should only include västra hamnen weekday menus
    // 2026-03-30 = Monday, 2026-03-31 = Tuesday
    expect(lunches).toHaveLength(3);
    expect(lunches[0]).toMatchObject({
      name: "Butter Chicken (Kyckling)",
      description: "Tomat, yoghurt, smör",
      price: 119,
      weekday: "måndag",
      place: "Kontrast",
    });
    expect(lunches[1]).toMatchObject({
      name: "Daal Makhni (Vegetariskt)",
      weekday: "måndag",
    });
    expect(lunches[2]).toMatchObject({
      name: "Ginger Beef (Kött)",
      weekday: "tisdag",
    });
  });

  it("skips weekend menus", async () => {
    const mockMenus = [
      { id: 1, date: "2026-03-28", location: "vastrahamnen", price: 119, isActive: true }, // Saturday
      { id: 2, date: "2026-03-29", location: "vastrahamnen", price: 119, isActive: true }, // Sunday
    ];

    parser.makeRequest = async (url) => {
      if (url.includes("/api/daily-menus")) return { json: async () => mockMenus };
      if (url.includes("/api/lunch-categories")) return { json: async () => [] };
      return { json: async () => [] };
    };

    const lunches = await parser.parseMenu();
    expect(lunches).toHaveLength(0);
  });

  it("skips non-västra-hamnen locations", async () => {
    const mockMenus = [
      { id: 1, date: "2026-03-30", location: "mollevangstorget", price: 99, isActive: true },
    ];

    parser.makeRequest = async (url) => {
      if (url.includes("/api/daily-menus")) return { json: async () => mockMenus };
      if (url.includes("/api/lunch-categories")) return { json: async () => [] };
      return { json: async () => [] };
    };

    const lunches = await parser.parseMenu();
    expect(lunches).toHaveLength(0);
  });

  it("calculates correct week number", () => {
    expect(parser.getWeekNumber(new Date(2026, 0, 5))).toBe(2);
    expect(parser.getWeekNumber(new Date(2026, 2, 30))).toBe(14);
  });
});
