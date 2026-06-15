import { describe, expect, it, beforeEach } from "vitest";
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

const mockCategories = [
  { id: 1, nameSv: "Kött" },
  { id: 2, nameSv: "Kyckling" },
  { id: 3, nameSv: "Vegetariskt" },
];

function mockRequests(parser, display) {
  parser.makeRequest = async (url) => {
    if (url.includes("/api/lunch-categories"))
      return { json: async () => mockCategories };
    if (url.includes("/api/lunch-display"))
      return { json: async () => display };
    return { json: async () => null };
  };
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

  it("parses the current day's menu from the lunch-display API", async () => {
    mockRequests(parser, {
      location: "vastra-hamnen",
      resolvedDate: "2026-06-15", // Monday, week 25
      weekday: 1,
      price: 125,
      dishes: [
        { nameSv: "Butter Chicken", descriptionSv: "Tomat, yoghurt, smör", categoryId: 2 },
        { nameSv: "Daal Makhni", descriptionSv: "Svarta linser", categoryId: 3 },
        { nameSv: "Ginger Beef", descriptionSv: "Ingefära, lök", categoryId: 1 },
      ],
    });

    const lunches = await parser.parseMenu();

    expect(lunches).toHaveLength(3);
    expect(lunches[0]).toMatchObject({
      name: "Butter Chicken (Kyckling)",
      description: "Tomat, yoghurt, smör",
      price: 125,
      weekday: "måndag",
      week: 25,
      place: "Kontrast",
    });
    expect(lunches[1]).toMatchObject({
      name: "Daal Makhni (Vegetariskt)",
      weekday: "måndag",
    });
    expect(lunches[2]).toMatchObject({
      name: "Ginger Beef (Kött)",
      weekday: "måndag",
    });
  });

  it("omits the category suffix when categoryId is unknown", async () => {
    mockRequests(parser, {
      resolvedDate: "2026-06-15",
      weekday: 1,
      price: 125,
      dishes: [{ nameSv: "Shahi Navratan", descriptionSv: "", categoryId: null }],
    });

    const lunches = await parser.parseMenu();
    expect(lunches).toHaveLength(1);
    expect(lunches[0].name).toBe("Shahi Navratan");
  });

  it("returns no items on weekends", async () => {
    mockRequests(parser, {
      resolvedDate: "2026-06-13", // Saturday
      weekday: 6,
      price: 125,
      dishes: [{ nameSv: "Butter Chicken", descriptionSv: "", categoryId: 2 }],
    });

    const lunches = await parser.parseMenu();
    expect(lunches).toHaveLength(0);
  });

  it("returns no items when there is no menu", async () => {
    mockRequests(parser, { resolvedDate: "2026-06-15", weekday: 1, price: 125, dishes: [] });
    expect(await parser.parseMenu()).toHaveLength(0);

    mockRequests(parser, null);
    expect(await parser.parseMenu()).toHaveLength(0);
  });

  it("calculates correct week number", () => {
    expect(parser.getWeekNumber(new Date(2026, 0, 5))).toBe(2);
    expect(parser.getWeekNumber(new Date(2026, 2, 30))).toBe(14);
  });
});
