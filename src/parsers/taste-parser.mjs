/**
 * Taste by Nordrest Malmö Parser
 *
 * The restaurant's page moved from tastebynordrest.se into the shared
 * Nordrest chain site (nordrest.se) in mid-2026. The new page is fully
 * server-rendered by the same castit-menus WordPress plugin: weekly lunches
 * live in `[data-week-panel]` blocks (`.castit-weekpanel`), each `.castit-day`
 * holds a `.castit-day__title` (weekday) and `.castit-dish` entries with a
 * `.castit-dish__title` (name) and an OPTIONAL `.castit-dish__desc`
 * (description). Prices are published in `.castit-lunch-meta` — the
 * "Lunchpris" item (135 SEK as of 2026-07) — with a hardcoded fallback.
 *
 * Notes:
 * - The active panel (matched via `data-active-week-index`) can be empty
 *   (`data-menu-id="0"`, no dishes) while a later panel holds the menu, so we
 *   fall back to the first populated panel.
 * - Closure placeholders (e.g. a single dish "SEMESTER STÄNGT ÖPPNAR IGEN
 *   3/8" during vacation weeks) are filtered out so a closed week yields zero
 *   lunches instead of a fake dish.
 * - Deep closures unpublish the week panels entirely (observed summer 2026):
 *   the page keeps the plugin's CSS/JS assets (e.g. `id="castit-menus-js"`)
 *   but renders no `[data-week-panel]` at all. That also yields zero lunches;
 *   only a page with no castit traces at all is treated as a parse failure.
 */

import { BaseParser } from "./base-parser.mjs";

const WEEKDAYS = ["måndag", "tisdag", "onsdag", "torsdag", "fredag"];
const DEFAULT_PRICE = 135;
const SITE_URL = "https://www.nordrest.se/restaurang/taste-by-nordrest-malmo/";

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
        // During closures the site unpublishes the week panels entirely —
        // only the castit plugin's assets remain. That is "no menu right
        // now", not a parse failure; a page without any castit traces at
        // all, however, means the template changed.
        if (this.safeQuery(document, '[id*="castit"], [class*="castit"]')) {
          await this.logger.info(
            "No castit week panels published (restaurant closed?) — returning 0 lunches",
          );
          return [];
        }
        throw new Error("Could not find castit week panel");
      }

      const weekNumber = this.extractWeekNumber(panel);
      const price = this.extractLunchPrice(document);
      const lunches = this.extractLunches(panel, weekNumber, price);

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
   * Find the week panel to parse. Prefer the currently-active panel (the
   * plugin marks the active index on a root element), but the active panel
   * can be an empty placeholder (data-menu-id="0", no dishes) while a later
   * panel holds the actual menu — fall back to the first populated panel.
   */
  findCurrentWeekPanel(document) {
    const panels = this.safeQuery(document, "[data-week-panel]", true);
    if (!panels || panels.length === 0) {
      return null;
    }

    const isPopulated = (panel) =>
      panel.getAttribute("data-menu-id") !== "0" &&
      !!this.safeQuery(panel, ".castit-dish");

    const root = this.safeQuery(document, "[data-active-week-index]");
    const activeIndex = root?.getAttribute("data-active-week-index");
    if (activeIndex != null) {
      const active = [...panels].find(
        (p) => p.getAttribute("data-week-index") === activeIndex,
      );
      if (active && isPopulated(active)) return active;
    }

    const firstPopulated = [...panels].find(isPopulated);
    return firstPopulated || panels[0];
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
   * Extract the lunch price from the page's meta block, e.g.
   * `<span class="castit-lunch-meta__item"><strong>Lunchpris</strong>: 135 SEK</span>`.
   * Only the "Lunchpris" item is used (the "Nordrest kort" item is a
   * discounted member price). Falls back to the default.
   */
  extractLunchPrice(document) {
    const items =
      this.safeQuery(document, ".castit-lunch-meta__item", true) || [];
    for (const item of items) {
      const text = this.extractText(item);
      if (!/lunchpris/i.test(text)) continue;
      const match = text.match(/(\d{2,3})\s*(?:SEK|kr|:-)/i);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
    return DEFAULT_PRICE;
  }

  /**
   * Extract lunches from the week panel's castit-day blocks
   */
  extractLunches(panel, weekNumber, price = DEFAULT_PRICE) {
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

        // Skip closure placeholders, e.g. "SEMESTER STÄNGT ÖPPNAR IGEN 3/8"
        // published as the only "dish" during vacation weeks.
        if (/semester|stängt/i.test(name)) continue;

        // Description is optional — absent when a dish has none.
        const descEl = this.safeQuery(dish, ".castit-dish__desc");
        const description = descEl ? this.extractText(descEl) : "";

        lunches.push(
          this.createLunchObject({
            name,
            description,
            price,
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
