/**
 * La Fonderie Restaurant Parser
 * Extends BaseParser to extract lunch menu data from La Fonderie
 */

import { BaseParser } from "./base-parser.mjs";
import { SWEDISH_WEEKDAYS } from "./parser-interfaces.mjs";

export class FonderieParser extends BaseParser {
  constructor(config = {}) {
    super({
      name: "La Fonderie",
      url: "https://www.lafonderie.se/lelunch",
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      ...config,
    });
  }

  getName() {
    return "La Fonderie";
  }

  getUrl() {
    return "https://www.lafonderie.se/lelunch";
  }

  async parseMenu() {
    try {
      await this.logger.info("Starting La Fonderie menu parsing");

      const document = await this.fetchDocument();

      const week = this.extractWeekNumber(document);
      const dishes = this.extractWeeklyDishes(document);

      const lunches = [];
      for (const { name, description, price } of dishes) {
        for (const weekday of SWEDISH_WEEKDAYS) {
          lunches.push(
            this.createLunchObject({
              name,
              description,
              price,
              weekday,
              week,
              place: this.getName(),
            }),
          );
        }
      }

      await this.logger.info("La Fonderie parsing completed", {
        totalLunches: lunches.length,
      });

      return lunches;
    } catch (error) {
      await this.logger.error("La Fonderie menu parsing failed", {}, error);
      throw error;
    }
  }

  /**
   * Extract week number from H1 matching /LE LUNCH v\.(\d+)/
   */
  extractWeekNumber(document) {
    const headings = this.safeQuery(document, "h1", true);
    if (!headings) return this._getCurrentWeek();

    for (const h1 of headings) {
      const text = this.extractText(h1);
      const match = text.match(/LE LUNCH v\.(\d+)/i);
      if (match) {
        return parseInt(match[1]);
      }
    }

    return this._getCurrentWeek();
  }

  /**
   * Extract weekly dishes from the VECKANS section
   * Parses pairs of <p> elements: first = dish name, second = description + price
   */
  extractWeeklyDishes(document) {
    const dishes = [];

    // Find the H4 "VECKANS" section
    const h4Elements = this.safeQuery(document, "h4", true);
    if (!h4Elements) return dishes;

    let veckansHeading = null;
    for (const h4 of h4Elements) {
      const text = this.extractText(h4).toUpperCase();
      if (text.includes("VECKANS")) {
        veckansHeading = h4;
        break;
      }
    }

    if (!veckansHeading) return dishes;

    // Collect all <p> elements after the VECKANS heading until next heading
    const paragraphs = [];
    let sibling = veckansHeading.nextElementSibling;
    while (sibling) {
      const tag = sibling.tagName.toLowerCase();
      if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4") break;

      if (tag === "p") {
        const text = this.extractText(sibling);
        if (text) {
          paragraphs.push(text);
        }
      }

      sibling = sibling.nextElementSibling;
    }

    // Parse pairs of paragraphs: name + description with price
    // Skip lines that are general notes (e.g., "Alla rätter serveras med...")
    let i = 0;
    while (i < paragraphs.length - 1) {
      const nameLine = paragraphs[i];
      const descLine = paragraphs[i + 1];

      // Check if the description line contains a price
      const priceMatch = descLine.match(/–\s*(\d+)\s*kr/);

      if (priceMatch) {
        dishes.push({
          name: nameLine,
          description: descLine.replace(/\s*–\s*\d+\s*kr\s*$/, "").trim(),
          price: parseInt(priceMatch[1]),
        });
        i += 2;
      } else {
        // Not a dish pair, skip this line
        i += 1;
      }
    }

    return dishes;
  }
}

export default FonderieParser;
