/**
 * Laziza Dockan Restaurant Parser
 * Extends BaseParser to extract lunch menu data from Laziza (fixed Lebanese lunch buffet)
 */

import { BaseParser } from "./base-parser.mjs";
import { SWEDISH_WEEKDAYS } from "./parser-interfaces.mjs";

export class LazizaParser extends BaseParser {
  constructor(config = {}) {
    super({
      name: "Laziza",
      url: "https://www.laziza.se/lunch/",
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      ...config,
    });
  }

  getName() {
    return "Laziza";
  }

  getUrl() {
    return "https://www.laziza.se/lunch/";
  }

  async parseMenu() {
    try {
      await this.logger.info("Starting Laziza menu parsing");

      const document = await this.fetchDocument();

      const price = this.extractPriceFromPage(document);
      const description = this.extractDescriptionFromPage(document);

      const week = this._getCurrentWeek();
      const lunches = [];

      for (const weekday of SWEDISH_WEEKDAYS) {
        lunches.push(
          this.createLunchObject({
            name: "Libanesisk lunchbuffé",
            description,
            price,
            weekday,
            week,
            place: this.getName(),
          }),
        );
      }

      await this.logger.info("Laziza parsing completed", {
        totalLunches: lunches.length,
        price,
      });

      return lunches;
    } catch (error) {
      await this.logger.error("Laziza menu parsing failed", {}, error);
      throw error;
    }
  }

  /**
   * Extract the buffet price from the page
   */
  extractPriceFromPage(document) {
    const bodyText = this.extractText(document.body);
    const priceMatch = bodyText.match(/(\d{2,3})\s*kr/i);
    if (priceMatch) {
      return parseInt(priceMatch[1]);
    }
    return 0;
  }

  /**
   * Extract the description text from the page. The lunch page lists hours
   * for all four locations; only the Dockan hours are relevant here, so a
   * single concise line is produced instead of the full location dump.
   */
  extractDescriptionFromPage(document) {
    const bodyText = this.extractText(document.body);
    const dockanMatch = bodyText.match(
      /dockan:?\s*(\d{1,2}:\d{2})\s*[—\-–]\s*(\d{1,2}:\d{2})/i,
    );
    if (dockanMatch) {
      return `Måndag till fredag ${dockanMatch[1]}–${dockanMatch[2]}`;
    }
    return "Måndag till fredag 11:00-15:00";
  }
}

export default LazizaParser;
