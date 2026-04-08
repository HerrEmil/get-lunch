/**
 * MiaMarias Parser
 * Extracts lunch menu from miamarias.nu/lunch/
 *
 * Structure: repeating pattern of:
 *   <h2>Vecka N</h2> (week number, once at top)
 *   <h2>Fisk|Kött|Vegetariskt</h2>  (category)
 *   <p>Dish description</p>
 *   <p>Price:-</p>
 * Groups of 3 categories per day, 5 days per week.
 */

import { BaseParser } from "./base-parser.mjs";

const WEEKDAYS = ["måndag", "tisdag", "onsdag", "torsdag", "fredag"];
const CATEGORIES = ["fisk", "kött", "vegetariskt"];

export class MiaMariasParser extends BaseParser {
  constructor(config = {}) {
    super({
      name: "MiaMarias",
      url: "https://miamarias.nu/lunch/",
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      ...config,
    });
  }

  getName() {
    return "MiaMarias";
  }

  getUrl() {
    return "https://miamarias.nu/lunch/";
  }

  async parseMenu() {
    try {
      await this.logger.info("Starting MiaMarias menu parsing");

      const document = await this.fetchDocument();
      const lunches = this.extractMenu(document);

      await this.logger.info("MiaMarias parsing completed", {
        totalLunches: lunches.length,
      });

      return lunches;
    } catch (error) {
      await this.logger.error("MiaMarias menu parsing failed", {}, error);
      throw error;
    }
  }

  extractMenu(document) {
    const lunches = [];
    const elements = document.querySelectorAll("h2, p");

    let week = this._getCurrentWeek();
    let dayIndex = 0;
    let pendingCategory = null;
    let pendingDish = null;

    for (const el of elements) {
      const text = el.textContent?.trim();
      if (!text) continue;
      const tag = el.tagName.toLowerCase();

      // Extract week number
      if (tag === "h2" && /^vecka\s+(\d+)/i.test(text)) {
        const match = text.match(/vecka\s+(\d+)/i);
        if (match) week = parseInt(match[1]);
        continue;
      }

      // Skip closure headings, but count them as consuming a day slot
      if (tag === "h2" && /stängt/i.test(text)) {
        // Skip remaining categories for this day
        pendingCategory = null;
        pendingDish = null;
        dayIndex++;
        continue;
      }

      // Category heading
      if (tag === "h2" && CATEGORIES.includes(text.toLowerCase())) {
        pendingCategory = text;
        pendingDish = null;
        continue;
      }

      // After a category heading, collect <p> tags as dish description until
      // we hit a price line. Descriptions may span multiple <p> tags.
      if (tag === "p" && pendingCategory) {
        if (pendingDish && this._looksLikePrice(text)) {
          // Price line — finalize the dish
          const price = this.extractNumber(text);
          const weekday = WEEKDAYS[dayIndex] || "måndag";

          lunches.push(
            this.createLunchObject({
              name: pendingCategory,
              description: pendingDish,
              price: price || 0,
              weekday,
              week,
              place: this.getName(),
            }),
          );

          // After the last category of a day (Vegetariskt), advance to next day
          if (pendingCategory.toLowerCase() === "vegetariskt") {
            dayIndex++;
          }

          pendingCategory = null;
          pendingDish = null;
        } else if (!pendingDish) {
          pendingDish = text;
        } else {
          // Continuation of multi-paragraph description
          pendingDish = `${pendingDish} ${text}`;
        }
      }
    }

    return lunches;
  }

  _looksLikePrice(text) {
    // MiaMarias formats prices as "130:-" or "130 kr"
    return /\d+\s*(:-|kr\b)/i.test(text);
  }
}

export default MiaMariasParser;
