/**
 * Ubåtshallen Parser
 * Extracts lunch menu from ubatshallen.se
 *
 * Structure: .entry-content contains <p> elements:
 *   - "Måndag" / "Tisdag" etc. as plain text
 *   - Next <p> has all dishes concatenated: "Det gröna: ...Husman: ...Internationell: ..."
 *   - Price in a later paragraph: "129,-"
 */

import { BaseParser } from "./base-parser.mjs";

const WEEKDAYS = ["måndag", "tisdag", "onsdag", "torsdag", "fredag"];
const CATEGORIES = ["det gröna", "husman", "internationell"];

export class UbatshallenParser extends BaseParser {
  constructor(config = {}) {
    super({
      name: "Ubåtshallen",
      url: "https://www.ubatshallen.se/",
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      ...config,
    });
  }

  getName() {
    return "Ubåtshallen";
  }

  getUrl() {
    return "https://www.ubatshallen.se/";
  }

  async parseMenu() {
    try {
      await this.logger.info("Starting Ubåtshallen menu parsing");

      const document = await this.fetchDocument();
      const lunches = this.extractMenu(document);

      await this.logger.info("Ubåtshallen parsing completed", {
        totalLunches: lunches.length,
      });

      return lunches;
    } catch (error) {
      await this.logger.error("Ubåtshallen menu parsing failed", {}, error);
      throw error;
    }
  }

  extractMenu(document) {
    const lunches = [];

    // Always use current week — Ubåtshallen's week number is often incorrect
    const week = this._getCurrentWeek();

    // Extract price from page text
    const allText = document.body?.textContent || "";
    const priceMatch = allText.match(/(\d{2,3})\s*[,:]?\s*-/);
    const price = priceMatch ? parseInt(priceMatch[1]) : 129;

    // Get all paragraphs in entry-content
    const content = this.safeQuery(document, ".entry-content");
    if (!content) return lunches;

    const paragraphs = content.querySelectorAll("p");
    let currentWeekday = null;

    for (const p of paragraphs) {
      const text = p.textContent?.trim();
      if (!text) continue;

      // Check if this paragraph is a weekday header
      const lower = text.toLowerCase().split(/[\s–\-]/)[0];
      if (WEEKDAYS.includes(lower)) {
        currentWeekday = lower;
        // Check if the day text contains closure info
        if (/stängt|stängd/i.test(text)) {
          currentWeekday = null;
        }
        continue;
      }

      // If we have a weekday and this paragraph has dish categories, parse them
      if (currentWeekday && /det gröna|husman|internationell/i.test(text)) {
        const dishes = this.splitDishes(text);
        for (const dish of dishes) {
          lunches.push(
            this.createLunchObject({
              name: dish.category,
              description: dish.text,
              price,
              weekday: currentWeekday,
              week,
              place: this.getName(),
            }),
          );
        }
        currentWeekday = null; // Each day has one paragraph with all dishes
      }
    }

    return lunches;
  }

  splitDishes(text) {
    const dishes = [];
    // Split on category labels: "Det gröna:", "Husman:", "Internationell:"
    const regex =
      /(Det gröna|Husman|Internationell)\s*:\s*/gi;
    const parts = text.split(regex).filter((s) => s.trim());

    for (let i = 0; i < parts.length - 1; i += 2) {
      const category = parts[i].trim();
      const dishText = parts[i + 1].trim();
      if (dishText) {
        dishes.push({ category, text: dishText });
      }
    }

    return dishes;
  }
}

export default UbatshallenParser;
