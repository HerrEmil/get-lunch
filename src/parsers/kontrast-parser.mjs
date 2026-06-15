/**
 * Kontrast Restaurant Parser (Västra Hamnen)
 * Fetches the current day's lunch menu from Kontrast's REST API.
 *
 * The site only exposes today's resolved menu publicly via
 * /api/lunch-display/<location> (the weekly templates require auth), so this
 * parser returns a single weekday's dishes per run. The data-collector runs
 * daily, accumulating the week as it goes.
 */

import { BaseParser } from "./base-parser.mjs";

const API_BASE = "https://www.kontrastrestaurang.se";
const LOCATION = "vastra-hamnen";

// /api/lunch-display reports weekday as ISO day number (1 = Monday ... 7 = Sunday)
const WEEKDAY_MAP = {
  1: "måndag",
  2: "tisdag",
  3: "onsdag",
  4: "torsdag",
  5: "fredag",
  6: "lördag",
  7: "söndag",
};

export class KontrastParser extends BaseParser {
  constructor(config = {}) {
    super({
      name: "Kontrast",
      url: `${API_BASE}/api/lunch-display/${LOCATION}`,
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      ...config,
    });
  }

  getName() {
    return "Kontrast";
  }

  getUrl() {
    return `${API_BASE}/menu/vastra-hamnen?tab=lunch`;
  }

  async parseMenu() {
    try {
      await this.logger.info("Starting Kontrast menu parsing");

      // Fetch today's resolved lunch menu and the category lookup in parallel
      const [display, categories] = await Promise.all([
        this.fetchJson(`/api/lunch-display/${LOCATION}`),
        this.fetchJson("/api/lunch-categories"),
      ]);

      if (!display || !Array.isArray(display.dishes) || display.dishes.length === 0) {
        await this.logger.warn("No lunch menu available for Västra Hamnen");
        return [];
      }

      const weekday = WEEKDAY_MAP[display.weekday];

      // Skip weekends (no weekday lunch served)
      if (!weekday || weekday === "lördag" || weekday === "söndag") {
        await this.logger.info("Skipping non-weekday menu", {
          weekday: display.weekday,
        });
        return [];
      }

      const categoryMap = Object.fromEntries(
        categories.map((c) => [c.id, c.nameSv]),
      );

      const date = new Date(display.resolvedDate + "T12:00:00");
      const week = this.getWeekNumber(date);

      const lunches = display.dishes.map((dish) => {
        const category = categoryMap[dish.categoryId] || "";
        return this.createLunchObject({
          name: `${dish.nameSv.trim()}${category ? " (" + category + ")" : ""}`,
          description: (dish.descriptionSv || "").trim(),
          price: display.price,
          weekday,
          week,
          place: this.getName(),
        });
      });

      await this.logger.info("Kontrast parsing completed", {
        totalLunches: lunches.length,
        weekday,
        date: display.resolvedDate,
      });

      return lunches;
    } catch (error) {
      await this.logger.error("Kontrast menu parsing failed", {}, error);
      throw error;
    }
  }

  /**
   * Fetch JSON from the Kontrast API
   */
  async fetchJson(path) {
    const response = await this.makeRequest(`${API_BASE}${path}`);
    return response.json();
  }

  /**
   * Get ISO week number from date
   */
  getWeekNumber(date) {
    const d = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
    );
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  }
}

export default KontrastParser;
