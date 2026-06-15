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
    // The page renders one or more week sections, each introduced by a
    // "Vecka N" heading and followed by up to five weekday slots. We parse
    // every section separately, then keep only the section for the current
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
