/**
 * SMAK (Restaurang SMAK, Malmö Konsthall) Parser
 *
 * SMAK's lunch page is hosted on the Gastrogate platform
 * (https://smak.gastrogate.com/lunch/), which renders the weekly menu
 * server-side as a single `table.lunch_menu`. The table is a flat sequence of
 * day blocks: a `thead.lunch-day-header` whose `<h3>` holds the day label,
 * followed by a `tbody.lunch-day-content` with one `tr.lunch-menu-item` per
 * dish. Each dish row has the name/description in `td.td_title` and the price
 * in `td.td_price .price-tag` (e.g. "159 kr").
 *
 * The `<h3>` is normally a weekday + date ("Måndag 13 juli"), but a plain
 * "hela veckan"/"veckans" block (a menu that applies to the whole week) is
 * also honoured by fanning its dishes out across Mon–Fri. A leading
 * non-weekday header ("Lunch på SMAK") introduces an included-items note with
 * an empty price — it is skipped because it names no weekday and has no price.
 *
 * The active ISO week is read from the week selector (`.menu-nav
 * a.dropdown-toggle`, e.g. "Vecka 29") with the current week as a fallback.
 */

import { BaseParser } from "./base-parser.mjs";

const WEEKDAYS = ["måndag", "tisdag", "onsdag", "torsdag", "fredag"];
const SITE_URL = "https://smak.gastrogate.com/lunch/";

export class SmakParser extends BaseParser {
  constructor(config = {}) {
    super({
      name: "SMAK",
      url: SITE_URL,
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      ...config,
    });
  }

  getName() {
    return "SMAK";
  }

  getUrl() {
    return SITE_URL;
  }

  async parseMenu() {
    try {
      await this.logger.info("Starting SMAK menu parsing");

      const document = await this.fetchDocument();
      const week = this.extractWeekNumber(document);
      const lunches = this.extractLunches(document, week);

      await this.logger.info("SMAK parsing completed", {
        totalLunches: lunches.length,
        week,
      });

      return lunches;
    } catch (error) {
      await this.logger.error("SMAK menu parsing failed", {}, error);
      throw error;
    }
  }

  /**
   * Read the active week from the Gastrogate week selector, e.g.
   * `<a class="btn ... dropdown-toggle">Vecka 29</a>`. Falls back to the
   * current ISO week.
   */
  extractWeekNumber(document) {
    const toggle =
      this.safeQuery(document, ".menu-nav a.dropdown-toggle") ||
      this.safeQuery(document, ".dropdown-menu li.active a");
    const match = this.extractText(toggle).match(/vecka\s*(\d{1,2})/i);
    if (match) {
      const week = parseInt(match[1], 10);
      if (week >= 1 && week <= 53) return week;
    }
    return this._getCurrentWeek();
  }

  /**
   * Walk the lunch table in document order, tracking the current day block's
   * weekday(s) from each `<h3>` header and attaching every following dish row
   * to it. Rows without a resolved weekday, without a title, or without a
   * price (the included-items intro note) are skipped.
   */
  extractLunches(document, week) {
    const lunches = [];
    const table = this.safeQuery(document, "table.lunch_menu");
    if (!table) {
      this.logger.warn("No lunch_menu table found");
      return lunches;
    }

    const nodes =
      this.safeQuery(
        table,
        ".lunch-day-header h3, tr.lunch-menu-item",
        true,
      ) || [];

    let currentWeekdays = [];
    for (const node of nodes) {
      if (node.tagName.toLowerCase() === "h3") {
        currentWeekdays = this.headerToWeekdays(this.extractText(node));
        continue;
      }

      if (currentWeekdays.length === 0) continue;

      const name = this.extractText(this.safeQuery(node, "td.td_title"))
        .replace(/\s+/g, " ")
        .trim();
      if (!name) continue;

      const priceMatch = this.extractText(
        this.safeQuery(node, ".price-tag"),
      ).match(/(\d{2,4})/);
      if (!priceMatch) continue;

      const price = parseInt(priceMatch[1], 10);
      for (const weekday of currentWeekdays) {
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

    return lunches;
  }

  /**
   * Map a day header to the weekday(s) it applies to. A weekday word wins; a
   * "hela veckan"/"veckans" header fans out to the whole week; anything else
   * (e.g. an intro note) resolves to no weekday and is ignored.
   */
  headerToWeekdays(headerText) {
    const text = headerText.toLowerCase();
    if (/hela\s+veck|veckans/.test(text)) {
      return [...WEEKDAYS];
    }
    const weekday = WEEKDAYS.find((wd) => text.includes(wd));
    return weekday ? [weekday] : [];
  }
}

export default SmakParser;
