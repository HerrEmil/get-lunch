/**
 * Kockum Fritid Restaurant Parser (FreDa49)
 * Extracts lunch menu from FreDa49's lunch page at Kockum Fritid
 *
 * The page has appeared in three formats over time, so extraction is tiered:
 *  1. Weekday-header format: "Lunch vecka N" + måndag/tisdag/... headers with
 *     dishes under each day (and a "Veckans vegetariska" all-week section).
 *  2. Flat weekly list (seen 2026-07): "Lunchmeny vecka N" followed by
 *     bold-span dish names with non-bold description lines. No weekday
 *     grouping — every dish is served all week. Price in "pris 136kr" line.
 *  3. Affärsluncher fallback (seen when no weekly menu is published): a
 *     "Vårens affärsluncher i Malmö" section with numbered dishes
 *     ("1. Fläskfilé ..."), applied to all weekdays. Price in the
 *     "Affärslunchen kostar 195kr" line.
 *
 * All menu content lives in <p class="mobile-undersized-upper"> elements.
 */

import { BaseParser } from "./base-parser.mjs";
import { SWEDISH_WEEKDAYS } from "./parser-interfaces.mjs";

const WEEKDAY_LABELS = [
  "måndag",
  "tisdag",
  "onsdag",
  "torsdag",
  "fredag",
];

const DEFAULT_WEEKLY_PRICE = 136;
const DEFAULT_BUSINESS_PRICE = 195;

export class KockumParser extends BaseParser {
  constructor(config = {}) {
    super({
      name: "Kockum Fritid",
      url: "https://www.freda49.se/lunch-malmo.html",
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      ...config,
    });
  }

  getName() {
    return "Kockum Fritid";
  }

  getUrl() {
    return "https://www.freda49.se/lunch-malmo.html";
  }

  async parseMenu() {
    try {
      await this.logger.info("Starting Kockum Fritid menu parsing");

      const document = await this.fetchDocument();
      const lunches = this.extractMenu(document);

      await this.logger.info("Kockum Fritid parsing completed", {
        totalLunches: lunches.length,
      });

      return lunches;
    } catch (error) {
      await this.logger.error("Kockum Fritid menu parsing failed", {}, error);
      throw error;
    }
  }

  extractMenu(document) {
    // Extract week number from "Lunch vecka 14/2026" or "Lunchmeny vecka 27"
    const allText = document.body?.textContent || "";
    const weekMatch = allText.match(/lunch(?:meny)?\s+vecka\s+(\d+)/i);
    const week = weekMatch ? parseInt(weekMatch[1]) : this._getCurrentWeek();

    // All content is in <p class="mobile-undersized-upper"> elements
    const paragraphs = [
      ...(document.querySelectorAll("p.mobile-undersized-upper") || []),
    ];
    if (paragraphs.length === 0) return [];

    // Tier 1: legacy weekday-header format (site may revert to it)
    const weekdayLunches = this.parseWeekdayFormat(paragraphs, week, allText);
    if (weekdayLunches.length > 0) return weekdayLunches;

    // Tier 2: flat "Lunchmeny vecka N" list — dishes served all week
    const weeklyLunches = this.parseWeeklyListFormat(paragraphs, week);
    if (weeklyLunches.length > 0) return weeklyLunches;

    // Tier 3: affärsluncher numbered list — applied to all weekdays
    return this.parseBusinessLunchFormat(paragraphs, week);
  }

  /**
   * Tier 1: weekday headers (måndag/tisdag/...) with dishes under each,
   * plus a "Veckans vegetariska" section applied to all weekdays.
   */
  parseWeekdayFormat(paragraphs, week, allText) {
    const lunches = [];
    const price = this.extractPrice(allText);

    let currentWeekday = null;
    let isVegetarian = false;
    let skipRest = false;

    for (const p of paragraphs) {
      const text = p.textContent.trim();
      if (!text) continue;

      // Skip the "Lunch vecka" / "Lunchmeny vecka" header
      if (/^lunch(?:meny)?\s+vecka/i.test(text)) continue;

      // Check if this is a weekday header
      const weekday = this.matchWeekday(text);
      if (weekday) {
        currentWeekday = weekday;
        isVegetarian = false;
        skipRest = false;
        continue;
      }

      // Check for vegetarian section header
      if (/veckans\s+vegetarisk/i.test(text)) {
        isVegetarian = true;
        currentWeekday = null; // Vegetarian dishes apply to all days
        skipRest = false;
        continue;
      }

      // Stop parsing at holiday markers or smörrebröd section
      if (/glad\s+påsk|god\s+jul|semesterstängt|stängt/i.test(text)) {
        skipRest = true;
        continue;
      }
      // Break at start of catering/smörrebröd section — everything after is
      // noise. Note: "affärslunch" is deliberately unanchored so the boundary
      // fires on "Vårens affärsluncher i Malmö" as well.
      if (/^smörrebröd|affärslunch/i.test(text)) break;
      if (skipRest) continue;

      // Skip very short text or non-dish content
      if (text.length < 5) continue;

      if (currentWeekday) {
        // Regular weekday dish
        lunches.push(
          this.createLunchObject({
            name: text,
            description: "",
            price,
            weekday: currentWeekday,
            week,
            place: this.getName(),
          }),
        );
      } else if (isVegetarian) {
        // Vegetarian dishes — create for all weekdays
        // But merge multi-line descriptions (short continuation lines)
        const lastVeg = lunches.filter(
          (l) => l.dietary?.includes("vegetarian"),
        );
        if (
          lastVeg.length > 0 &&
          text.length < 40 &&
          !text.includes("/") &&
          !/^[A-ZÅÄÖ]/.test(text)
        ) {
          // Continuation of previous line — append to all instances
          for (const l of lunches) {
            if (
              l.name === lastVeg[lastVeg.length - 1].name &&
              l.dietary?.includes("vegetarian")
            ) {
              l.name = `${l.name} ${text}`;
            }
          }
        } else {
          for (const day of WEEKDAY_LABELS) {
            // Don't duplicate if a specific day already has enough dishes
            lunches.push(
              this.createLunchObject({
                name: text,
                description: "",
                price,
                weekday: day,
                week,
                place: this.getName(),
                dietary: ["vegetarian"],
              }),
            );
          }
        }
      }
    }

    return lunches;
  }

  /**
   * Tier 2: flat weekly list under a "Lunchmeny vecka N" heading. Dish names
   * are bold spans; the following non-bold line(s) are the description.
   * There is no weekday grouping — every dish is served all week, so each
   * dish is emitted for måndag–fredag (same pattern as the old "veckans
   * vegetariska" handling).
   */
  parseWeeklyListFormat(paragraphs, week) {
    const lunches = [];
    const startIdx = paragraphs.findIndex((p) =>
      /lunch(?:meny)?\s+vecka/i.test(p.textContent),
    );
    if (startIdx === -1) return lunches;

    let price = DEFAULT_WEEKLY_PRICE;
    const dishes = [];
    let currentDish = null;

    for (let i = startIdx + 1; i < paragraphs.length; i++) {
      const text = paragraphs[i].textContent.trim();
      if (!text) continue; // &nbsp;/<br> spacer paragraphs

      // "Serveras mellan 11.00-14.00, pris 136kr" — scoped price extraction
      const priceMatch = text.match(/pris\s*(\d{2,3})\s*kr/i);
      if (priceMatch) {
        price = parseInt(priceMatch[1]);
        continue;
      }

      // Info lines that are not dishes
      if (/^(serveras\s+mellan|ingår)/i.test(text)) continue;

      // Boundary: the affärsluncher/catering block ends the weekly menu
      if (/affärslunch|avhämtning|catering/i.test(text)) break;

      if (this.hasBoldText(paragraphs[i])) {
        // Bold span = new dish name (handles bold nested in a non-bold span)
        if (currentDish) dishes.push(currentDish);
        currentDish = { name: text, description: "" };
      } else if (currentDish) {
        // Non-bold line following a dish = its description
        currentDish.description = currentDish.description
          ? `${currentDish.description} ${text}`
          : text;
      }
    }
    if (currentDish) dishes.push(currentDish);

    for (const dish of dishes) {
      for (const day of WEEKDAY_LABELS) {
        lunches.push(
          this.createLunchObject({
            name: dish.name,
            description: dish.description,
            price,
            weekday: day,
            week,
            place: this.getName(),
          }),
        );
      }
    }

    return lunches;
  }

  /**
   * Tier 3: "Vårens affärsluncher i Malmö" numbered list ("1. Fläskfilé ...").
   * Used when no weekly lunch menu is published. Dishes apply to all
   * weekdays; price comes from the "Affärslunchen kostar 195kr" line.
   */
  parseBusinessLunchFormat(paragraphs, week) {
    const lunches = [];
    const startIdx = paragraphs.findIndex((p) =>
      /affärslunch/i.test(p.textContent),
    );
    if (startIdx === -1) return lunches;

    let price = DEFAULT_BUSINESS_PRICE;
    const dishes = [];

    for (let i = startIdx + 1; i < paragraphs.length; i++) {
      const text = paragraphs[i].textContent.trim();
      if (!text) continue;

      // Numbered dish: "1. Fläskfilé med kålfrikassé & dragonrostade potatisar"
      const dishMatch = text.match(/^\d+\.\s*(.+)$/);
      if (dishMatch) {
        dishes.push(dishMatch[1].trim());
        continue;
      }

      // "Affärslunchen kostar 195kr / person" — scoped price, ends the section
      const priceMatch = text.match(/kostar\s*(\d{2,3})\s*kr/i);
      if (priceMatch) {
        price = parseInt(priceMatch[1]);
        break;
      }

      // Any other prose after we have collected dishes ends the section
      if (dishes.length > 0) break;
    }

    for (const name of dishes) {
      for (const day of WEEKDAY_LABELS) {
        lunches.push(
          this.createLunchObject({
            name,
            description: "",
            price,
            weekday: day,
            week,
            place: this.getName(),
          }),
        );
      }
    }

    return lunches;
  }

  /**
   * True if the paragraph (or any descendant) carries bold styling.
   * The site uses inline styles, e.g. <span style="font-weight: bold;">,
   * sometimes nested inside a non-bold span.
   */
  hasBoldText(p) {
    if (/font-weight:\s*bold/i.test(p.getAttribute?.("style") || "")) {
      return true;
    }
    const styled = p.querySelectorAll?.("[style]") || [];
    for (const el of styled) {
      if (/font-weight:\s*bold/i.test(el.getAttribute("style") || "")) {
        return true;
      }
    }
    return !!p.querySelector?.("b, strong");
  }

  extractPrice(text) {
    const match = text.match(/(\d{2,3})\s*kr/i);
    return match ? parseInt(match[1]) : DEFAULT_WEEKLY_PRICE;
  }

  matchWeekday(text) {
    const lower = text.toLowerCase().trim();
    for (const day of SWEDISH_WEEKDAYS) {
      if (lower === day || lower.startsWith(day + " ")) {
        return day;
      }
    }
    return null;
  }
}

export default KockumParser;
