/**
 * PAPI Saluhallen Restaurant Parser
 * Extends BaseParser to extract lunch menu data from PAPI (Italian pasta bar)
 */

import { BaseParser } from "./base-parser.mjs";
import { SWEDISH_WEEKDAYS } from "./parser-interfaces.mjs";

const SKIP_ITEMS = [
  "arancini",
  "sardeller",
  "ostbricka",
  "charkbricka",
  "tiramisu",
  "doppio-meny",
  "pasta all in",
];

export class PapiParser extends BaseParser {
  constructor(config = {}) {
    super({
      name: "PAPI",
      url: "https://www.papisaluhallen.se/",
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      ...config,
    });
  }

  getName() {
    return "PAPI";
  }

  getUrl() {
    return "https://www.papisaluhallen.se/";
  }

  async parseMenu() {
    try {
      await this.logger.info("Starting PAPI menu parsing");

      const document = await this.fetchDocument();

      const dishes = this.extractDishes(document);
      const week = this._getCurrentWeek();

      const lunches = [];
      for (const { name, price } of dishes) {
        for (const weekday of SWEDISH_WEEKDAYS) {
          lunches.push(
            this.createLunchObject({
              name,
              description: "",
              price,
              weekday,
              week,
              place: this.getName(),
            }),
          );
        }
      }

      await this.logger.info("PAPI parsing completed", {
        totalLunches: lunches.length,
      });

      return lunches;
    } catch (error) {
      await this.logger.error("PAPI menu parsing failed", {}, error);
      throw error;
    }
  }

  /**
   * Extract dishes from the page by finding menu section headings (h2)
   * and then scanning h4 dish names with prices in nearby text.
   */
  extractDishes(document) {
    const dishes = [];
    const seen = new Set();

    const sectionHeadings = this.safeQuery(document, "h2", true);
    if (!sectionHeadings) return dishes;

    for (const section of sectionHeadings) {
      const sectionText = this.extractText(section);
      if (!/dagens|varje vecka/i.test(sectionText)) continue;

      // Walk siblings after section heading until next h2
      let sibling = section.nextElementSibling;
      while (sibling) {
        const tag = sibling.tagName.toLowerCase();
        if (tag === "h1" || tag === "h2") break;

        // Dish names appear in h3/h4 headings
        if (tag === "h3" || tag === "h4") {
          const name = this.extractText(sibling);
          if (name && !this._shouldSkip(name) && !seen.has(name.toLowerCase())) {
            // Look for price in the heading text itself or following siblings
            const price = this._findPrice(sibling);
            if (price > 0) {
              seen.add(name.toLowerCase());
              dishes.push({ name, price });
            }
          }
        }

        sibling = sibling.nextElementSibling;
      }
    }

    return dishes;
  }

  /**
   * Find a price (XXX kr) starting from an element.
   * Checks the element text first, then walks following siblings
   * until a heading or another dish is found.
   */
  _findPrice(element) {
    // Check element itself
    const selfMatch = this.extractText(element).match(/(\d{2,3})\s*kr/);
    if (selfMatch) return parseInt(selfMatch[1]);

    // Check following siblings
    let sibling = element.nextElementSibling;
    while (sibling) {
      const tag = sibling.tagName.toLowerCase();
      if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4") break;

      const text = this.extractText(sibling);
      const priceMatch = text.match(/(\d{2,3})\s*kr/);
      if (priceMatch) return parseInt(priceMatch[1]);

      sibling = sibling.nextElementSibling;
    }

    return 0;
  }

  /**
   * Check if a dish name matches any skip pattern (appetizers, desserts, combos)
   */
  _shouldSkip(name) {
    const lower = name.toLowerCase();
    return SKIP_ITEMS.some((skip) => lower.includes(skip));
  }
}

export default PapiParser;
