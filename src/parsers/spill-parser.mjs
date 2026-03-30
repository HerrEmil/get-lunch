/**
 * Spill Gängtappen Restaurant Parser
 * Extends BaseParser to extract lunch menu data from Restaurang Spill (Gängtappen location)
 */

import { BaseParser } from "./base-parser.mjs";
import { SWEDISH_WEEKDAYS } from "./parser-interfaces.mjs";

export class SpillParser extends BaseParser {
  constructor(config = {}) {
    super({
      name: "Spill",
      url: "https://www.restaurangspill.se/",
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      ...config,
    });
  }

  getName() {
    return "Spill";
  }

  getUrl() {
    return "https://www.restaurangspill.se/";
  }

  async parseMenu() {
    try {
      await this.logger.info("Starting Spill Gängtappen menu parsing");

      const document = await this.fetchDocument();

      const dagensSection = this.safeQuery(document, "#dagens");
      if (!dagensSection) {
        throw new Error("Could not find #dagens section");
      }

      const lunches = await this.extractGangtappenMenu(dagensSection);

      await this.logger.info("Spill parsing completed", {
        totalLunches: lunches.length,
      });

      return lunches;
    } catch (error) {
      await this.logger.error("Spill menu parsing failed", {}, error);
      throw error;
    }
  }

  /**
   * Extract menu items from the Gängtappen section only
   */
  async extractGangtappenMenu(container) {
    const lunches = [];

    // Find all h2/h3 elements to locate the Gängtappen section
    const headings = this.safeQuery(container, "h2, h3", true);
    if (!headings) {
      await this.logger.warn("No headings found in #dagens");
      return lunches;
    }

    // Find the Gängtappen section by looking for its heading,
    // then walk up to a container that includes the full menu content.
    let gangtappenContainer = null;
    for (const heading of headings) {
      const text = this.extractText(heading).toLowerCase();
      if (text.includes("gängtappen") || text.includes("gangtappen")) {
        // Walk up until we find a parent whose text includes a weekday or date
        let el = heading.parentElement;
        while (el && el !== container) {
          const elText = this.extractText(el).toLowerCase();
          if (
            elText.length > 100 &&
            (elText.includes("kr") || /\d{1,2}\/\d{1,2}/.test(elText))
          ) {
            gangtappenContainer = el;
            break;
          }
          el = el.parentElement;
        }
        break;
      }
    }

    if (!gangtappenContainer) {
      // Fallback: try the first flex-1 section (Gängtappen is listed first)
      const sections = this.safeQuery(container, "[class*='flex-1']", true);
      if (sections && sections.length > 0) {
        gangtappenContainer = sections[0];
        await this.logger.info(
          "Using first flex-1 section as Gängtappen fallback",
        );
      }
    }

    if (!gangtappenContainer) {
      await this.logger.warn("Could not find Gängtappen section");
      return lunches;
    }

    // Extract date and weekday
    const { weekday, week } = this.extractDateInfo(gangtappenContainer);

    if (!weekday) {
      await this.logger.warn("Could not extract weekday from Gängtappen section");
      return lunches;
    }

    // Extract the menu text content
    const menuText = this.extractMenuText(gangtappenContainer);
    if (!menuText) {
      await this.logger.warn("No menu text found in Gängtappen section");
      return lunches;
    }

    // Extract price
    const price = this.extractPrice(gangtappenContainer);

    // Parse the main dish
    const { mainDish, vegetarianDish } = this.parseMenuText(menuText);

    if (mainDish) {
      lunches.push(
        this.createLunchObject({
          name: mainDish,
          description: "",
          price,
          weekday,
          week,
          place: this.getName(),
        }),
      );
    }

    if (vegetarianDish) {
      lunches.push(
        this.createLunchObject({
          name: vegetarianDish,
          description: "",
          price,
          weekday,
          week,
          place: this.getName(),
          dietary: ["vegetarian"],
        }),
      );
    }

    return lunches;
  }

  /**
   * Extract date info from the section to determine weekday and week number
   */
  extractDateInfo(container) {
    const result = { weekday: null, week: null };

    // Look for the date text (format: "FREDAG, 27/3, 2026" in an uppercase div)
    const allText = this.extractText(container).toLowerCase();

    // Try to find a Swedish weekday
    for (const day of SWEDISH_WEEKDAYS) {
      if (allText.includes(day)) {
        result.weekday = day;
        break;
      }
    }

    // Try to extract a date to calculate week number
    // Format: "27/3, 2026" or "27/3 2026"
    const dateMatch = allText.match(
      /(\d{1,2})\/(\d{1,2})[,\s]+(\d{4})/,
    );
    if (dateMatch) {
      const day = parseInt(dateMatch[1]);
      const month = parseInt(dateMatch[2]);
      const year = parseInt(dateMatch[3]);
      try {
        const date = new Date(year, month - 1, day);
        result.week = this.getWeekNumber(date);
      } catch {
        result.week = this._getCurrentWeek();
      }
    } else {
      result.week = this._getCurrentWeek();
    }

    return result;
  }

  /**
   * Get ISO week number from date
   */
  getWeekNumber(date) {
    const d = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
    );
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  }

  /**
   * Extract the menu description text from the section
   */
  extractMenuText(container) {
    // The menu description is in a div with dangerouslySetInnerHTML
    // Look for the longest text block that isn't a heading or price
    const allDivs = this.safeQuery(container, "div, p", true);
    if (!allDivs) return null;

    let bestText = "";
    for (const el of allDivs) {
      const text = this.extractText(el).trim();
      // Skip short texts (dates, prices, headings)
      if (text.length < 20) continue;
      // Skip if it contains mostly non-menu content
      if (text.includes("Beställ") || text.includes("Weiq")) continue;

      // Prefer longer, descriptive text blocks
      if (text.length > bestText.length) {
        bestText = text;
      }
    }

    return bestText || null;
  }

  /**
   * Extract price from the section
   */
  extractPrice(container) {
    const text = this.extractText(container);
    // Match patterns like "135kr", "135 kr"
    const priceMatch = text.match(/(\d{2,3})\s*kr/i);
    if (priceMatch) {
      return parseInt(priceMatch[1]);
    }
    return 0;
  }

  /**
   * Parse menu text into main dish and optional vegetarian dish
   */
  parseMenuText(text) {
    const result = { mainDish: null, vegetarianDish: null };

    if (!text) return result;

    // Split on "Vegetarisk:" or "Vegetariskt:" or "Veg:"
    const vegSplit = text.split(/vegetarisk[t]?\s*[:/]\s*/i);

    if (vegSplit.length >= 2) {
      result.mainDish = this.cleanDishText(vegSplit[0]);
      result.vegetarianDish = this.cleanDishText(vegSplit[1]);
    } else {
      result.mainDish = this.cleanDishText(text);
    }

    return result;
  }

  /**
   * Clean up dish description text
   */
  cleanDishText(text) {
    if (!text) return null;

    let cleaned = text
      .replace(/\s+/g, " ")
      .replace(/^\s*[,.\-–]\s*/, "")
      .replace(/\s*[,.\-–]\s*$/, "")
      .trim();

    // Remove leading weekday if present
    for (const day of SWEDISH_WEEKDAYS) {
      const regex = new RegExp(`^${day}[,\\s]*`, "i");
      cleaned = cleaned.replace(regex, "");
    }

    // Remove date patterns
    cleaned = cleaned.replace(/\d{1,2}\/\d{1,2}[,\s]*\d{4}/, "").trim();

    return cleaned.length > 0 ? cleaned : null;
  }
}

export default SpillParser;
