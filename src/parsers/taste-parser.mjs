/**
 * Taste by Nordrest Malmö Parser
 * Extends BaseParser to extract lunch menu data from Taste by Nordrest
 * Server-rendered HTML with #previous, #current, #next week sections
 */

import { BaseParser } from "./base-parser.mjs";

const WEEKDAYS = ["måndag", "tisdag", "onsdag", "torsdag", "fredag"];

export class TasteParser extends BaseParser {
  constructor(config = {}) {
    super({
      name: "Taste",
      url: "https://www.tastebynordrest.se/17/6/taste-malmo/",
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      ...config,
    });
  }

  getName() {
    return "Taste";
  }

  getUrl() {
    return "https://www.tastebynordrest.se/17/6/taste-malmo/";
  }

  async parseMenu() {
    try {
      await this.logger.info("Starting Taste menu parsing");

      const document = await this.fetchDocument();
      const currentSection = this.safeQuery(document, "#current");

      if (!currentSection) {
        throw new Error("Could not find #current section");
      }

      const weekNumber = this.extractWeekNumber(currentSection);
      const price = this.extractPrice(currentSection);
      const lunches = this.extractLunches(currentSection, weekNumber, price);

      await this.logger.info("Taste parsing completed", {
        totalLunches: lunches.length,
        uniqueWeekdays: [...new Set(lunches.map((l) => l.weekday))].length,
      });

      return lunches;
    } catch (error) {
      await this.logger.error("Taste menu parsing failed", {}, error);
      throw error;
    }
  }

  /**
   * Extract week number from section text
   */
  extractWeekNumber(section) {
    try {
      const text = this.extractText(section);
      const match = text.match(/vecka\s*(\d+)/i);
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

  /**
   * Extract price from section text
   */
  extractPrice(section) {
    try {
      const text = this.extractText(section);
      const match = text.match(/(\d{2,3})\s*kr/i);
      if (match) {
        return parseInt(match[1]);
      }
    } catch (error) {
      this.logger.warn("Error extracting price", { error: error.message });
    }
    return 135;
  }

  /**
   * Extract lunches from the current section
   */
  extractLunches(section, weekNumber, price) {
    const lunches = [];
    const h6Elements = this.safeQuery(section, "h6", true);

    if (!h6Elements) {
      this.logger.warn("No h6 day headers found in current section");
      return lunches;
    }

    for (const h6 of h6Elements) {
      const dayText = this.extractText(h6).toLowerCase().trim();
      const weekday = WEEKDAYS.find((wd) => dayText.includes(wd));

      if (!weekday) {
        continue;
      }

      // Collect <p> elements following this <h6> until next <h6>
      const pElements = [];
      let sibling = h6.nextElementSibling;
      while (sibling && sibling.tagName !== "H6") {
        if (sibling.tagName === "P") {
          pElements.push(sibling);
        }
        sibling = sibling.nextElementSibling;
      }

      // Pair elements: odd index = dish name, even index = description (eng-meny)
      for (let i = 0; i < pElements.length - 1; i += 2) {
        const nameEl = pElements[i];
        const descEl = pElements[i + 1];

        const name = this.extractText(nameEl);
        if (!name) continue;

        const description = this.extractText(descEl);

        lunches.push(
          this.createLunchObject({
            name,
            description,
            price,
            weekday,
            week: weekNumber,
            place: this.getName(),
          }),
        );
      }
    }

    return lunches;
  }
}

export default TasteParser;
