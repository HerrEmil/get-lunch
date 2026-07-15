/**
 * Kitchen961 Restaurant Parser
 * Extends BaseParser to extract lunch menu data from Kitchen961
 * (fixed Lebanese lunch buffé, Pilgatan 3, Malmö).
 *
 * The site (WordPress/Elementor) publishes a single fixed buffé rather than
 * per-day dishes and shows no week number, so — like the Laziza parser — we
 * emit one synthetic buffé entry per weekday using the computed ISO week.
 * Weekday price (149 kr) and the higher Friday price (169 kr) are read from
 * the page text.
 */

import { BaseParser } from "./base-parser.mjs";
import { SWEDISH_WEEKDAYS } from "./parser-interfaces.mjs";

export class Kitchen961Parser extends BaseParser {
  constructor(config = {}) {
    super({
      name: "Kitchen961",
      url: "https://kitchen961.se/lunchen/",
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      ...config,
    });
  }

  getName() {
    return "Kitchen961";
  }

  getUrl() {
    return "https://kitchen961.se/lunchen/";
  }

  async parseMenu() {
    try {
      await this.logger.info("Starting Kitchen961 menu parsing");

      const document = await this.fetchDocument();

      const { weekdayPrice, fridayPrice } = this.extractPrices(document);
      const description = this.extractDescription(document);

      const week = this._getCurrentWeek();
      const lunches = [];

      for (const weekday of SWEDISH_WEEKDAYS) {
        lunches.push(
          this.createLunchObject({
            name: "Libanesisk lunchbuffé",
            description,
            price: weekday === "fredag" ? fridayPrice : weekdayPrice,
            weekday,
            week,
            place: this.getName(),
          }),
        );
      }

      await this.logger.info("Kitchen961 parsing completed", {
        totalLunches: lunches.length,
        weekdayPrice,
        fridayPrice,
      });

      return lunches;
    } catch (error) {
      await this.logger.error("Kitchen961 menu parsing failed", {}, error);
      throw error;
    }
  }

  /**
   * Extract the weekday and Friday buffé prices from the page text.
   * Page reads e.g. "Dagens lunch 149 kr/ Fredagar 169 kr."
   * Falls back to the first generic "NNN kr" for the weekday price, and to the
   * weekday price for Friday when no separate Friday price is published.
   */
  extractPrices(document) {
    const bodyText = this.extractText(document.body);

    const weekdayMatch = bodyText.match(/Dagens lunch\s+(\d{2,3})\s*kr/i);
    const fridayMatch = bodyText.match(/Fredag(?:ar)?\s+(\d{2,3})\s*kr/i);
    const genericMatch = bodyText.match(/(\d{2,3})\s*kr/i);

    const weekdayPrice = weekdayMatch
      ? parseInt(weekdayMatch[1])
      : genericMatch
        ? parseInt(genericMatch[1])
        : 0;
    const fridayPrice = fridayMatch ? parseInt(fridayMatch[1]) : weekdayPrice;

    return { weekdayPrice, fridayPrice };
  }

  /**
   * Extract the buffé description ("Meza; Libanesisk Salladsbuffe. …") from the
   * page text, collapsing whitespace. Falls back to the lunch hours.
   */
  extractDescription(document) {
    const bodyText = this.extractText(document.body);

    const descMatch = bodyText.match(/Meza[\s\S]*?fruktfat\.?/i);
    if (descMatch) {
      return descMatch[0].replace(/\s+/g, " ").trim();
    }

    return "Måndag-Fredag 11.00 – 14.30";
  }
}

export default Kitchen961Parser;
