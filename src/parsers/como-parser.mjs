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
   * Structure: H2 "Lunchmeny V.XX" → UL → LI items, each with H3 category
   * and text content like "category description price"
   */
  extractDishes(document) {
    const dishes = [];
    const categories = ["kött", "fisk", "veg", "sallad"];

    // Find the Lunchmeny heading
    const headings = this.safeQuery(document, "h2", true);
    if (!headings) return dishes;

    let lunchHeading = null;
    for (const heading of headings) {
      if (this.extractText(heading).toLowerCase().includes("lunchmeny")) {
        lunchHeading = heading;
        break;
      }
    }

    if (!lunchHeading) return dishes;

    // The menu is in the UL immediately after the heading
    const ul = lunchHeading.nextElementSibling;
    if (!ul || ul.tagName.toLowerCase() !== "ul") return dishes;

    const items = this.safeQuery(ul, "li", true);
    if (!items) return dishes;

    for (const li of items) {
      const h3 = this.safeQuery(li, "h3");
      if (!h3) continue;

      const categoryName = this.extractText(h3).toLowerCase();
      if (!categories.includes(categoryName)) continue;

      // Full text is "category description price" (price is just a number)
      const fullText = this.extractText(li).replace(/\s+/g, " ").trim();

      // Remove the category prefix
      const withoutCategory = fullText
        .replace(new RegExp(`^${categoryName}\\s*`, "i"), "")
        .trim();

      // Price is the trailing number
      const priceMatch = withoutCategory.match(/\s(\d{2,3})$/);
      if (!priceMatch) continue;

      const price = parseInt(priceMatch[1]);
      const description = withoutCategory
        .substring(0, priceMatch.index)
        .trim();

      const capitalizedCategory =
        categoryName.charAt(0).toUpperCase() + categoryName.slice(1);

      dishes.push({
        name: capitalizedCategory,
        description,
        price,
      });
    }

    return dishes;
  }
}

export default ComoParser;
