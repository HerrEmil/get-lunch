/**
 * Restaurang Varv Parser
 * Extends BaseParser to extract lunch menu data from Restaurang Varv
 *
 * Varv's Squarespace page has been published with the week heading as an <h1>
 * and, later, as an <h2>, so both are searched for "Lunch menu week <n>".
 *
 * The lunch price is only read from a heading that explicitly names it
 * ("Lunch for 145" / "Lunch 145 kr"). The page's Breakfast and Coffee sections
 * carry prices of their own, and those must never be mistaken for the lunch
 * price. When no lunch price is published at all, no lunches are emitted
 * rather than emitting rows with a fabricated 0 kr.
 */

import { BaseParser } from "./base-parser.mjs";

const WEEK_PATTERN = /Lunch menu week\s+(\d+)/i;

const PRICE_PATTERNS = [/Lunch for\s+(\d+)/i, /Lunch\s+(\d+)\s*(?:kr|:-)/i];

const ENGLISH_TO_SWEDISH = {
  monday: "måndag",
  tuesday: "tisdag",
  wednesday: "onsdag",
  thursday: "torsdag",
  friday: "fredag",
};

const ENGLISH_WEEKDAYS = Object.keys(ENGLISH_TO_SWEDISH);

export class VarvParser extends BaseParser {
  constructor(config = {}) {
    super({
      name: "Varv",
      url: "https://varvmalmo.com/menu",
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      ...config,
    });
  }

  getName() {
    return "Varv";
  }

  getUrl() {
    return "https://varvmalmo.com/menu";
  }

  async parseMenu() {
    try {
      await this.logger.info("Starting Varv menu parsing");

      const document = await this.fetchDocument();

      const { week, price, dayDishes } = this.extractMenuData(document);

      if (price === null) {
        await this.logger.warn(
          "Varv publishes no lunch price - skipping menu",
          { week },
        );
        return [];
      }

      const lunches = [];
      for (const { weekday, dishes } of dayDishes) {
        for (const dish of dishes) {
          lunches.push(
            this.createLunchObject({
              name: dish,
              description: "",
              price,
              weekday,
              week,
              place: this.getName(),
            }),
          );
        }
      }

      await this.logger.info("Varv parsing completed", {
        totalLunches: lunches.length,
      });

      return lunches;
    } catch (error) {
      await this.logger.error("Varv menu parsing failed", {}, error);
      throw error;
    }
  }

  /**
   * Extract all menu data from the document
   */
  extractMenuData(document) {
    const week = this.extractWeekNumber(document);
    const price = this.extractPrice(document);
    const dayDishes = this.extractDayDishes(document);

    return { week, price, dayDishes };
  }

  /**
   * Extract week number from H1/H2 containing "Lunch menu week"
   */
  extractWeekNumber(document) {
    const headings = this.safeQuery(document, "h1, h2", true);
    if (!headings) return this._getCurrentWeek();

    for (const heading of headings) {
      const match = this.extractText(heading).match(WEEK_PATTERN);
      if (match) {
        return parseInt(match[1]);
      }
    }

    return this._getCurrentWeek();
  }

  /**
   * Extract the lunch price from a H1/H2 that explicitly names it
   * @returns {number|null} Price, or null when no lunch price is published
   */
  extractPrice(document) {
    const headings = this.safeQuery(document, "h1, h2", true);
    if (!headings) return null;

    for (const heading of headings) {
      const text = this.extractText(heading);
      for (const pattern of PRICE_PATTERNS) {
        const match = text.match(pattern);
        if (match) {
          return parseInt(match[1]);
        }
      }
    }

    return null;
  }

  /**
   * Extract dishes grouped by day from H2 day headers and following P elements
   */
  extractDayDishes(document) {
    const dayDishes = [];

    const headings = this.safeQuery(document, "h2", true);
    if (!headings) return dayDishes;

    for (const h2 of headings) {
      const text = this.extractText(h2).toLowerCase();
      const dayName = ENGLISH_WEEKDAYS.find((day) => text === day);

      if (!dayName) continue;

      const swedishDay = ENGLISH_TO_SWEDISH[dayName];
      const dishes = [];

      // Collect following <p> elements until next non-empty <h2>
      let sibling = h2.nextElementSibling;
      while (sibling) {
        if (
          sibling.tagName.toLowerCase() === "h2" &&
          this.extractText(sibling).trim().length > 0
        )
          break;

        if (sibling.tagName.toLowerCase() === "p") {
          const dishText = this.extractText(sibling).trim();
          if (
            dishText &&
            !/^(or|eller)$/i.test(dishText) &&
            !this._isItalicNote(sibling)
          ) {
            dishes.push(dishText);
          }
        }

        sibling = sibling.nextElementSibling;
      }

      if (dishes.length > 0) {
        dayDishes.push({ weekday: swedishDay, dishes });
      }
    }

    return dayDishes;
  }

  /**
   * A paragraph whose entire content is italicised is site boilerplate
   * (e.g. "<em>All dishes are available for take-away.</em>"), not a dish
   * @private
   */
  _isItalicNote(paragraph) {
    if (paragraph.children.length !== 1) return false;

    const child = paragraph.children[0];
    const tagName = child.tagName.toLowerCase();
    if (tagName !== "em" && tagName !== "i") return false;

    return this.extractText(child) === this.extractText(paragraph);
  }
}

export default VarvParser;
