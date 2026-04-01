/**
 * COMO Restaurant Parser
 * Extends BaseParser to extract lunch menu data from COMO Malmö
 */

import { BaseParser } from "./base-parser.mjs";
import { SWEDISH_WEEKDAYS } from "./parser-interfaces.mjs";

export class ComoParser extends BaseParser {
  constructor(config = {}) {
    super({
      name: "COMO",
      url: "https://comomalmo.se/meny",
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      ...config,
    });
  }

  getName() {
    return "COMO";
  }

  getUrl() {
    return "https://comomalmo.se/meny";
  }

  async parseMenu() {
    try {
      await this.logger.info("Starting COMO menu parsing");

      const document = await this.fetchDocument();

      const week = this.extractWeekNumber(document);
      const dishes = this.extractDishes(document);

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

      await this.logger.info("COMO parsing completed", {
        totalLunches: lunches.length,
      });

      return lunches;
    } catch (error) {
      await this.logger.error("COMO menu parsing failed", {}, error);
      throw error;
    }
  }

  /**
   * Extract week number from text matching "V.XX" or "Vecka XX"
   */
  extractWeekNumber(document) {
    const body = document.body;
    if (!body) return this._getCurrentWeek();

    const text = this.extractText(body);
    const match = text.match(/(?:V\.|Vecka)\s*(\d+)/i);
    if (match) {
      return parseInt(match[1]);
    }

    return this._getCurrentWeek();
  }

  /**
   * Extract dishes from the lunch menu section.
   * Looks for category names (Kött, Fisk, Veg, Sallad) followed by dish info and price.
   */
  extractDishes(document) {
    const dishes = [];

    // Find the Lunchmeny heading to scope our search
    const headings = this.safeQuery(document, "h1, h2, h3, h4", true);
    if (!headings) return dishes;

    let lunchSection = null;
    for (const heading of headings) {
      const text = this.extractText(heading);
      if (text.toLowerCase().includes("lunchmeny")) {
        lunchSection = heading;
        break;
      }
    }

    if (!lunchSection) return dishes;

    // Collect all elements after the lunchmeny heading until next major heading
    const elements = [];
    let sibling = lunchSection.nextElementSibling;
    while (sibling) {
      const tag = sibling.tagName.toLowerCase();
      // Stop at a heading that isn't an h3 (h3 is used for dish names within the section)
      if (tag === "h1" || tag === "h2") break;
      elements.push(sibling);
      sibling = sibling.nextElementSibling;
    }

    const categories = ["kött", "fisk", "veg", "sallad"];

    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      const text = this.extractText(el);
      if (!text) continue;

      // Check if this element contains a category name
      const textLower = text.toLowerCase();
      const matchedCategory = categories.find((cat) =>
        textLower.startsWith(cat),
      );

      if (matchedCategory) {
        const dish = this.parseDishFromElements(elements, i, matchedCategory);
        if (dish) {
          dishes.push(dish);
        }
      }
    }

    return dishes;
  }

  /**
   * Parse a dish starting from a category element.
   * The category element or subsequent elements contain the dish name, description, and price.
   */
  parseDishFromElements(elements, categoryIndex, category) {
    const categoryEl = elements[categoryIndex];
    const categoryText = this.extractText(categoryEl);

    // Try to extract price from the category element or nearby elements
    let fullText = categoryText;

    // Also look at the next element(s) for dish details
    for (let j = categoryIndex + 1; j < elements.length && j <= categoryIndex + 2; j++) {
      const nextText = this.extractText(elements[j]);
      if (!nextText) continue;

      // Stop if we hit another category
      const nextLower = nextText.toLowerCase();
      const categories = ["kött", "fisk", "veg", "sallad"];
      if (categories.some((cat) => nextLower.startsWith(cat))) break;

      fullText += " " + nextText;
    }

    // Extract price
    const priceMatch = fullText.match(/(\d+)\s*kr/);
    if (!priceMatch) return null;

    const price = parseInt(priceMatch[1]);

    // Remove category prefix and price from text to get the dish description
    let dishText = fullText;

    // Remove the category label (e.g., "Kött:" or "Kött -")
    const categoryPattern = new RegExp(
      `^${category}[:\\s–\\-]*`,
      "i",
    );
    dishText = dishText.replace(categoryPattern, "").trim();

    // Remove price suffix
    dishText = dishText.replace(/\s*[-–]?\s*\d+\s*kr\s*$/, "").trim();

    // Use category as the name, dish text as description
    const capitalizedCategory =
      category.charAt(0).toUpperCase() + category.slice(1);

    return {
      name: capitalizedCategory,
      description: dishText,
      price,
    };
  }
}

export default ComoParser;
