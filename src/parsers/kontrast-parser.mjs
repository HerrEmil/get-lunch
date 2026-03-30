/**
 * Kontrast Restaurant Parser (Västra Hamnen)
 * Fetches lunch menu data from Kontrast's REST API
 */

import { BaseParser } from "./base-parser.mjs";

const API_BASE = "https://www.kontrastrestaurang.se";
const LOCATION = "vastrahamnen";

const WEEKDAY_MAP = [
  "söndag",
  "måndag",
  "tisdag",
  "onsdag",
  "torsdag",
  "fredag",
  "lördag",
];

export class KontrastParser extends BaseParser {
  constructor(config = {}) {
    super({
      name: "Kontrast",
      url: `${API_BASE}/api/daily-menus`,
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
    return `${API_BASE}/vastra-hamnen/`;
  }

  async parseMenu() {
    try {
      await this.logger.info("Starting Kontrast menu parsing");

      // Fetch daily menus, categories, and dishes in parallel
      const [menus, categories] = await Promise.all([
        this.fetchJson("/api/daily-menus"),
        this.fetchJson("/api/lunch-categories"),
      ]);

      const categoryMap = Object.fromEntries(
        categories.map((c) => [c.id, c.nameSv]),
      );

      // Filter to västra hamnen menus only
      const vhMenus = menus.filter(
        (m) => m.location === LOCATION && m.isActive,
      );

      if (vhMenus.length === 0) {
        await this.logger.warn("No active menus found for Västra Hamnen");
        return [];
      }

      // Fetch dishes for each menu
      const lunches = [];
      for (const menu of vhMenus) {
        const dishes = await this.fetchJson(
          `/api/daily-menus/${menu.id}/dishes`,
        );
        const date = new Date(menu.date + "T12:00:00");
        const weekday = WEEKDAY_MAP[date.getDay()];

        // Skip weekends
        if (weekday === "lördag" || weekday === "söndag") continue;

        const week = this.getWeekNumber(date);

        for (const dish of dishes) {
          const category = categoryMap[dish.categoryId] || "";
          lunches.push(
            this.createLunchObject({
              name: `${dish.nameSv}${category ? " (" + category + ")" : ""}`,
              description: dish.descriptionSv || "",
              price: menu.price,
              weekday,
              week,
              place: this.getName(),
            }),
          );
        }
      }

      await this.logger.info("Kontrast parsing completed", {
        totalLunches: lunches.length,
        uniqueWeekdays: [...new Set(lunches.map((l) => l.weekday))].length,
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
