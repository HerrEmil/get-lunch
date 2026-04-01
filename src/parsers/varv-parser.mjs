/**
 * Restaurang Varv Parser
 * Extends BaseParser to extract lunch menu data from Restaurang Varv
 */

import { BaseParser } from "./base-parser.mjs";
import { SWEDISH_WEEKDAYS } from "./parser-interfaces.mjs";

const ENGLISH_TO_SWEDISH = {
  monday: "måndag",
  tuesday: "tisdag",
  wednesday: "onsdag",
  thursday: "torsdag",
  friday: "fredag",
};

const ENGLISH_WEEKDAYS = Object.keys(ENGLISH_TO_SWEDISH);

export class VarvParser extends BaseParser {
  constructor(config = {}) {
    super({
      name: "Varv",
      url: "https://varvmalmo.com/menu",
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      ...config,
    });
  }

  getName() {
    return "Varv";
  }

  getUrl() {
    return "https://varvmalmo.com/menu";
  }

  async parseMenu() {
    try {
      await this.logger.info("Starting Varv menu parsing");

      const document = await this.fetchDocument();

      const { week, price, dayDishes } = this.extractMenuData(document);

      const lunches = [];
      for (const { weekday, dishes } of dayDishes) {
        for (const dish of dishes) {
          lunches.push(
            this.createLunchObject({
              name: dish,
              description: "",
              price,
              weekday,
              week,
              place: this.getName(),
            }),
          );
        }
      }

      await this.logger.info("Varv parsing completed", {
        totalLunches: lunches.length,
      });

      return lunches;
    } catch (error) {
      await this.logger.error("Varv menu parsing failed", {}, error);
      throw error;
    }
  }

  /**
   * Extract all menu data from the document
   */
  extractMenuData(document) {
    const week = this.extractWeekNumber(document);
    const price = this.extractPrice(document);
    const dayDishes = this.extractDayDishes(document);

    return { week, price, dayDishes };
  }

  /**
   * Extract week number from H1 containing "Lunch menu week"
   */
  extractWeekNumber(document) {
    const headings = this.safeQuery(document, "h1", true);
    if (!headings) return this._getCurrentWeek();

    for (const h1 of headings) {
      const text = this.extractText(h1);
      const match = text.match(/Lunch menu week\s+(\d+)/i);
      if (match) {
        return parseInt(match[1]);
      }
    }

    return this._getCurrentWeek();
  }

  /**
   * Extract price from H2 containing "Lunch for (\d+)"
   */
  extractPrice(document) {
    const headings = this.safeQuery(document, "h2", true);
    if (!headings) return 0;

    for (const h2 of headings) {
      const text = this.extractText(h2);
      const match = text.match(/Lunch for\s+(\d+)/i);
      if (match) {
        return parseInt(match[1]);
      }
    }

    return 0;
  }

  /**
   * Extract dishes grouped by day from H2 day headers and following P elements
   */
  extractDayDishes(document) {
    const dayDishes = [];

    const headings = this.safeQuery(document, "h2", true);
    if (!headings) return dayDishes;

    for (const h2 of headings) {
      const text = this.extractText(h2).toLowerCase();
      const dayName = ENGLISH_WEEKDAYS.find((day) => text === day);

      if (!dayName) continue;

      const swedishDay = ENGLISH_TO_SWEDISH[dayName];
      const dishes = [];

      // Collect following <p> elements until next non-empty <h2>
      let sibling = h2.nextElementSibling;
      while (sibling) {
        if (
          sibling.tagName.toLowerCase() === "h2" &&
          this.extractText(sibling).trim().length > 0
        )
          break;

        if (sibling.tagName.toLowerCase() === "p") {
          const dishText = this.extractText(sibling).trim();
          if (dishText && !/^(or|eller)$/i.test(dishText)) {
            dishes.push(dishText);
          }
        }

        sibling = sibling.nextElementSibling;
      }

      if (dishes.length > 0) {
        dayDishes.push({ weekday: swedishDay, dishes });
      }
    }

    return dayDishes;
  }
}

export default VarvParser;
