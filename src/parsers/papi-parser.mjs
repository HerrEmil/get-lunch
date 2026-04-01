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
  "testa 2 rätter",
  "ost- och charkbricka",
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
   * Extract dishes from the page.
   * Structure: H2 "Dagens" / "Varje vecka:" → UL → LI items with H4 name
   * and full text like "name description XXXkr"
   */
  extractDishes(document) {
    const dishes = [];
    const seen = new Set();

    const sectionHeadings = this.safeQuery(document, "h2", true);
    if (!sectionHeadings) return dishes;

    for (const section of sectionHeadings) {
      const sectionText = this.extractText(section);
      if (!/dagens|varje vecka/i.test(sectionText)) continue;

      // The menu items are in the UL immediately after the heading
      const ul = section.nextElementSibling;
      if (!ul || ul.tagName.toLowerCase() !== "ul") continue;

      const items = this.safeQuery(ul, "li", true);
      if (!items) continue;

      for (const li of items) {
        const h4 = this.safeQuery(li, "h4");
        if (!h4) continue;

        const name = this.extractText(h4);
        if (!name || this._shouldSkip(name) || seen.has(name.toLowerCase())) {
          continue;
        }

        // Price is at the end of the li text: "...XXXkr"
        const fullText = this.extractText(li).replace(/\s+/g, " ").trim();
        const priceMatch = fullText.match(/(\d{2,3})\s*kr/);
        if (!priceMatch) continue;

        seen.add(name.toLowerCase());
        dishes.push({ name, price: parseInt(priceMatch[1]) });
      }
    }

    return dishes;
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
