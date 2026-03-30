/**
 * P2 Restaurant Parser
 * Extends BaseParser to extract lunch menu data from Restaurang P2
 * Uses identical HTML structure to Niagara (CSS class-based day sections)
 */

import { BaseParser } from "./base-parser.mjs";

const CSS_TO_WEEKDAY = {
  monday: "måndag",
  tuesday: "tisdag",
  wednesday: "onsdag",
  thursday: "torsdag",
  friday: "fredag",
};

export class P2Parser extends BaseParser {
  constructor(config = {}) {
    super({
      name: "P2",
      url: "https://restaurangp2.se/",
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      ...config,
    });
  }

  getName() {
    return "P2";
  }

  getUrl() {
    return "https://restaurangp2.se/";
  }

  async parseMenu() {
    try {
      await this.logger.info("Starting P2 menu parsing");

      const document = await this.fetchDocument();
      const body = document.body || document;
      const weekNumber = this.extractWeekNumber(body);
      const lunches = [];

      for (const [cssClass, weekday] of Object.entries(CSS_TO_WEEKDAY)) {
        const daySection = this.safeQuery(body, `.${cssClass}`);
        if (!daySection) {
          await this.logger.debug(`No section found for ${weekday}`);
          continue;
        }

        const containers = this.safeQuery(
          daySection,
          ".lunchmeny_container",
          true,
        );
        if (!containers) {
          await this.logger.debug(`No lunch containers found for ${weekday}`);
          continue;
        }

        for (const container of containers) {
          const titleEl = this.safeQuery(container, ".lunch_title");
          const descEl = this.safeQuery(container, ".lunch_desc");
          const priceEl = this.safeQuery(container, ".lunch_price");

          const title = this.extractText(titleEl);
          if (!title || title.toLowerCase().includes("stängt")) {
            continue;
          }

          const description = this.extractText(descEl);
          const priceText = this.extractText(priceEl);
          const price = this.extractNumber(priceText) || 128;

          lunches.push(
            this.createLunchObject({
              name: title,
              description,
              price,
              weekday,
              week: weekNumber,
              place: this.getName(),
            }),
          );
        }
      }

      await this.logger.info("P2 parsing completed", {
        totalLunches: lunches.length,
        uniqueWeekdays: [...new Set(lunches.map((l) => l.weekday))].length,
      });

      return lunches;
    } catch (error) {
      await this.logger.error("P2 menu parsing failed", {}, error);
      throw error;
    }
  }

  /**
   * Extract week number from container element
   */
  extractWeekNumber(container) {
    try {
      const bodyText = this.extractText(container);
      const match = bodyText.match(/[Vv]ecka\s*(\d+)/);
      if (match) {
        const week = parseInt(match[1]);
        if (week >= 1 && week <= 53) {
          this.logger.debug(`Found week number: ${week}`);
          return week;
        }
      }
    } catch (error) {
      this.logger.warn("Error extracting week number", { error: error.message });
    }

    const fallback = this._getCurrentWeek();
    this.logger.debug(`Using current week as fallback: ${fallback}`);
    return fallback;
  }
}

export default P2Parser;
