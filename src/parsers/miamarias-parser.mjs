/**
 * MiaMarias Parser
 * Extracts lunch menu from miamarias.nu/lunch/
 *
 * Structure: an Elementor day-tab widget (.e-n-tabs) whose tab titles carry
 * the weekday — possibly decorated (e.g. "Schnitzelfredag" for Friday) — and
 * whose content panels each hold that day's categories:
 *   <h2>Vecka N</h2> (week number, once at top, outside the tabs)
 *   <h2>Fisk|Kött|Vegetariskt</h2>  (category)
 *   <p>Dish description</p>
 *   <p>Price:-</p>
 * When no tab widget is present we fall back to walking the flat h2/p stream,
 * assuming groups of 3 categories per day, 5 days per week.
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
    // Preferred path: the live page renders a day-tab widget whose tab titles
    // name each weekday (sometimes decorated, e.g. "Schnitzelfredag"). Using
    // the titles pins every panel to its weekday explicitly, so notice
    // headings inside a panel (e.g. a "Stängt" banner on Friday's panel)
    // cannot shift the day assignment.
    const tabbed = this._parseDayTabs(document);
    if (tabbed) return tabbed;

    // Fallback: one or more week sections, each introduced by a "Vecka N"
    // heading and followed by up to five weekday slots. We parse every
    // section separately, then keep only the section for the current
    // ISO week so two weeks can never be merged into one (and overflow
    // weekday slots are dropped rather than folded onto Monday).
    const sections = this._parseSections(document);

    if (sections.length === 0) return [];

    const currentWeek = this._getCurrentWeek();
    const current = sections.find((s) => s.week === currentWeek);

    // Fall back to the first (top-most / most current) section when the page
    // does not advertise the current week number explicitly.
    return (current || sections[0]).lunches;
  }

  /**
   * Parse the Elementor day-tab widget, mapping each content panel to the
   * weekday named by its tab title. Titles may be decorated — any title that
   * CONTAINS a weekday name counts (e.g. "Schnitzelfredag" -> fredag);
   * titles without a weekday name are skipped rather than guessed at.
   * @private
   * @returns {Array|null} lunches, or null when no usable tab widget exists
   */
  _parseDayTabs(document) {
    const widgets = document.querySelectorAll(".e-n-tabs");
    if (widgets.length === 0) return null;

    const week = this._findWeek(document);
    const lunches = [];
    let matchedAnyDay = false;

    for (const widget of widgets) {
      const titles = widget.querySelectorAll(
        ".e-n-tabs-heading .e-n-tab-title-text",
      );
      const panels = widget.querySelector(".e-n-tabs-content")?.children ?? [];
      const count = Math.min(titles.length, panels.length);

      for (let i = 0; i < count; i++) {
        const weekday = this._weekdayFromText(titles[i].textContent);
        if (!weekday) continue;
        matchedAnyDay = true;
        lunches.push(...this._parsePanel(panels[i], weekday, week));
      }
    }

    // No weekday-titled tab at all: the structure is not the one we know,
    // so let the caller fall back to the flat-stream parser.
    return matchedAnyDay ? lunches : null;
  }

  /**
   * Extract category/dish/price triplets from a single day panel.
   * Non-category headings inside the panel (e.g. "Stängt", "Torsdagens
   * soppa") reset the pending state so their paragraphs are not captured.
   * @private
   */
  _parsePanel(panel, weekday, week) {
    const lunches = [];
    let pendingCategory = null;
    let pendingDish = null;

    for (const el of panel.querySelectorAll("h2, p")) {
      const text = el.textContent?.trim();
      if (!text) continue;

      if (el.tagName.toLowerCase() === "h2") {
        pendingCategory = CATEGORIES.includes(text.toLowerCase())
          ? text
          : null;
        pendingDish = null;
        continue;
      }

      if (!pendingCategory) continue;

      if (pendingDish && this._looksLikePrice(text)) {
        lunches.push(
          this.createLunchObject({
            name: pendingCategory,
            description: pendingDish,
            price: this.extractNumber(text) || 0,
            weekday,
            week,
            place: this.getName(),
          }),
        );
        pendingCategory = null;
        pendingDish = null;
      } else if (!pendingDish) {
        pendingDish = text;
      } else {
        pendingDish = `${pendingDish} ${text}`;
      }
    }

    return lunches;
  }

  /**
   * Map text to a weekday when it contains a weekday name (case-insensitive).
   * @private
   * @returns {string|null}
   */
  _weekdayFromText(text) {
    const lower = (text || "").toLowerCase();
    return WEEKDAYS.find((day) => lower.includes(day)) || null;
  }

  /**
   * Week number from the page's "Vecka N" heading, else the current ISO week.
   * @private
   */
  _findWeek(document) {
    for (const el of document.querySelectorAll("h2")) {
      const match = el.textContent?.trim().match(/^vecka\s+(\d+)/i);
      if (match) return parseInt(match[1]);
    }
    return this._getCurrentWeek();
  }

  /**
   * Split the document into per-week sections.
   * @private
   * @returns {Array<{week: number, lunches: Array}>}
   */
  _parseSections(document) {
    const elements = document.querySelectorAll("h2, p");
    const sections = [];
    let section = null;

    let dayIndex = 0;
    let pendingCategory = null;
    let pendingDish = null;

    const startSection = (week) => {
      section = { week, lunches: [] };
      sections.push(section);
      dayIndex = 0;
      pendingCategory = null;
      pendingDish = null;
    };

    for (const el of elements) {
      const text = el.textContent?.trim();
      if (!text) continue;
      const tag = el.tagName.toLowerCase();

      // A "Vecka N" heading begins a new week section.
      if (tag === "h2" && /^vecka\s+(\d+)/i.test(text)) {
        const match = text.match(/vecka\s+(\d+)/i);
        startSection(match ? parseInt(match[1]) : this._getCurrentWeek());
        continue;
      }

      // Content before the first week heading: open an implicit section so a
      // page without a "Vecka N" heading still yields data.
      if (!section) startSection(this._getCurrentWeek());

      // Skip closure headings, but count them as consuming a day slot.
      if (tag === "h2" && /stängt/i.test(text)) {
        pendingCategory = null;
        pendingDish = null;
        dayIndex++;
        continue;
      }

      // Category heading.
      if (tag === "h2" && CATEGORIES.includes(text.toLowerCase())) {
        pendingCategory = text;
        pendingDish = null;
        continue;
      }

      // After a category heading, collect <p> tags as dish description until
      // we hit a price line. Descriptions may span multiple <p> tags.
      if (tag === "p" && pendingCategory) {
        if (pendingDish && this._looksLikePrice(text)) {
          const price = this.extractNumber(text);
          const weekday = WEEKDAYS[dayIndex];

          // Only emit weekday slots that fall within Mon–Fri. Anything beyond
          // Friday belongs to a different (next) week and is discarded rather
          // than collapsed onto Monday.
          if (weekday) {
            section.lunches.push(
              this.createLunchObject({
                name: pendingCategory,
                description: pendingDish,
                price: price || 0,
                weekday,
                week: section.week,
                place: this.getName(),
              }),
            );
          }

          // After the last category of a day (Vegetariskt), advance to next day.
          if (pendingCategory.toLowerCase() === "vegetariskt") {
            dayIndex++;
          }

          pendingCategory = null;
          pendingDish = null;
        } else if (!pendingDish) {
          pendingDish = text;
        } else {
          // Continuation of multi-paragraph description.
          pendingDish = `${pendingDish} ${text}`;
        }
      }
    }

    return sections;
  }

  _looksLikePrice(text) {
    // MiaMarias formats prices as "130:-" or "130 kr"
    return /\d+\s*(:-|kr\b)/i.test(text);
  }
}

export default MiaMariasParser;
