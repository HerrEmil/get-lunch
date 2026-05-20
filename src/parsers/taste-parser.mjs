/**
 * Taste by Nordrest Malmö Parser
 *
 * The site moved to WordPress + the castit-menus plugin, which server-renders
 * the weekly lunch into `[data-week-panel]` blocks. Each `.castit-day` holds a
 * `.castit-day__title` (weekday) and several `.castit-dish` entries, each with
 * a `.castit-dish__title` (name) and `.castit-dish__desc` (description). No
 * price is shown on the page, so we fall back to a default.
 */

import { BaseParser } from "./base-parser.mjs";

const WEEKDAYS = ["måndag", "tisdag", "onsdag", "torsdag", "fredag"];
const DEFAULT_PRICE = 135;
const SITE_URL = "https://www.tastebynordrest.se/17/6/taste-malmo/";

export class TasteParser extends BaseParser {
  constructor(config = {}) {
    super({
      name: "Taste",
      url: SITE_URL,
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      ...config,
    });
  }

  getName() {
    return "Taste";
  }

  getUrl() {
    return SITE_URL;
  }

  async parseMenu() {
    try {
      await this.logger.info("Starting Taste menu parsing");

      const document = await this.fetchDocument();
      const panel = this.findCurrentWeekPanel(document);

      if (!panel) {
        throw new Error("Could not find castit week panel");
      }

      const weekNumber = this.extractWeekNumber(panel);
      const lunches = this.extractLunches(panel, weekNumber);

      await this.logger.info("Taste parsing completed", {
        totalLunches: lunches.length,
        uniqueWeekdays: [...new Set(lunches.map((l) => l.weekday))].length,
      });

      return lunches;
    } catch (error) {
      await this.logger.error("Taste menu parsing failed", {}, error);
      throw error;
    }
  }

  /**
   * Find the currently-active week panel. The plugin marks the active index on
   * a root element; fall back to the first rendered panel.
   */
  findCurrentWeekPanel(document) {
    const panels = this.safeQuery(document, "[data-week-panel]", true);
    if (!panels || panels.length === 0) {
      return null;
    }

    const root = this.safeQuery(document, "[data-active-week-index]");
    const activeIndex = root?.getAttribute("data-active-week-index");
    if (activeIndex != null) {
      const active = [...panels].find(
        (p) => p.getAttribute("data-week-index") === activeIndex,
      );
      if (active) return active;
    }

    return panels[0];
  }

  /**
   * Extract week number from the panel's data-week attribute (with text fallback)
   */
  extractWeekNumber(panel) {
    const attr = parseInt(panel.getAttribute("data-week"), 10);
    if (attr >= 1 && attr <= 53) {
      return attr;
    }

    const match = this.extractText(panel).match(/v(?:ecka|\.)?\s*(\d+)/i);
    if (match) {
      const week = parseInt(match[1], 10);
      if (week >= 1 && week <= 53) return week;
    }

    return this._getCurrentWeek();
  }

  /**
   * Extract lunches from the week panel's castit-day blocks
   */
  extractLunches(panel, weekNumber) {
    const lunches = [];
    const days = this.safeQuery(panel, ".castit-day", true);

    if (!days || days.length === 0) {
      this.logger.warn("No castit-day blocks found in week panel");
      return lunches;
    }

    for (const day of days) {
      const dayText = this.extractText(
        this.safeQuery(day, ".castit-day__title") || day,
      )
        .toLowerCase()
        .trim();
      const weekday = WEEKDAYS.find((wd) => dayText.includes(wd));

      if (!weekday) {
        continue;
      }

      const dishes = this.safeQuery(day, ".castit-dish", true) || [];
      for (const dish of dishes) {
        const name = this.extractText(
          this.safeQuery(dish, ".castit-dish__title") || dish,
        );
        if (!name) continue;

        const descEl = this.safeQuery(dish, ".castit-dish__desc");
        const description = descEl ? this.extractText(descEl) : "";

        lunches.push(
          this.createLunchObject({
            name,
            description,
            price: DEFAULT_PRICE,
            weekday,
            week: weekNumber,
            place: this.getName(),
          }),
        );
      }
    }

    return lunches;
  }
}

export default TasteParser;
