/**
 * Holy Greens Dockan Restaurant Parser
 * Extends BaseParser to extract menu data from Holy Greens (fixed salad & bowl menu)
 */

import { BaseParser } from "./base-parser.mjs";
import { SWEDISH_WEEKDAYS } from "./parser-interfaces.mjs";

export class HolyGreensParser extends BaseParser {
  constructor(config = {}) {
    super({
      name: "Holy Greens",
      url: "https://holygreens.se/meny/",
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      ...config,
    });
  }

  getName() {
    return "Holy Greens";
  }

  getUrl() {
    return "https://holygreens.se/meny/";
  }

  async parseMenu() {
    try {
      await this.logger.info("Starting Holy Greens menu parsing");

      const document = await this.fetchDocument();

      const itemNames = this.extractItemNames(document);
      const description = itemNames.length > 0
        ? itemNames.slice(0, 5).join(", ")
        : "";

      const week = this._getCurrentWeek();
      const lunches = [];

      for (const weekday of SWEDISH_WEEKDAYS) {
        lunches.push(
          this.createLunchObject({
            name: "Sallader & Hot Bowls",
            description,
            price: 0,
            weekday,
            week,
            place: this.getName(),
          }),
        );
      }

      await this.logger.info("Holy Greens parsing completed", {
        totalLunches: lunches.length,
        itemsFound: itemNames.length,
      });

      return lunches;
    } catch (error) {
      await this.logger.error("Holy Greens menu parsing failed", {}, error);
      throw error;
    }
  }

  /**
   * Extract dish names from .item elements on the page
   */
  extractItemNames(document) {
    const items = this.safeQuery(document, ".item", true);
    if (!items) return [];

    const names = [];
    for (const item of items) {
      const heading = this.safeQuery(item, "h3");
      if (heading) {
        const name = this.extractText(heading);
        if (name) {
          names.push(name);
        }
      }
    }

    return names;
  }
}

export default HolyGreensParser;
