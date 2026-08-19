/**
 * Kockum Fritid Restaurant Parser (FreDa49)
 * Extracts lunch menu from FreDa49's lunch page at Kockum Fritid
 *
 * The page has appeared in three formats over time, so extraction is tiered:
 *  1. Weekday-header format: "Lunch vecka N" + måndag/tisdag/... headers with
 *     dishes under each day, followed by all-week sections ("Veckans
 *     vegetariska", "Veckans sallader", "Veckans 3 smörrebröd").
 *  2. Flat weekly list (seen 2026-07): "Lunchmeny vecka N" followed by
 *     bold-span dish names with non-bold description lines. No weekday
 *     grouping — every dish is served all week. Price in "pris 136kr" line.
 *  3. Affärsluncher fallback (seen when no weekly menu is published): a
 *     "Vårens affärsluncher i Malmö" section with numbered dishes
 *     ("1. Fläskfilé ..."), applied to all weekdays. Price in the
 *     "Affärslunchen kostar 195kr" line.
 *
 * Menu content lives in <p class="mobile-undersized-upper"> elements, except
 * the all-week section headings — see collectMenuParagraphs. A dish is a GROUP
 * of paragraphs rather than a paragraph — see parseWeekdayFormat.
 */

import { BaseParser } from "./base-parser.mjs";
import { SWEDISH_WEEKDAYS } from "./parser-interfaces.mjs";

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

    // Menu content is in <p class="mobile-undersized-upper"> elements. One
    // traversal, then partition — collectMenuParagraphs needs the others too.
    const allParagraphs = [...document.querySelectorAll("p")];
    const paragraphs = allParagraphs.filter((p) =>
      p.classList.contains("mobile-undersized-upper"),
    );
    if (paragraphs.length === 0) return [];

    // Tier 1: weekday-header format. It needs the section headings too, so it
    // gets the widened paragraph list; tiers 2/3 key off bold spans and must
    // not see extra bold paragraphs.
    const weekdayLunches = this.parseWeekdayFormat(
      this.collectMenuParagraphs(allParagraphs, paragraphs),
      week,
      allText,
    );
    if (weekdayLunches.length > 0) return weekdayLunches;

    // Tier 2: flat "Lunchmeny vecka N" list — dishes served all week
    const weeklyLunches = this.parseWeeklyListFormat(paragraphs, week);
    if (weeklyLunches.length > 0) return weeklyLunches;

    // Tier 3: affärsluncher numbered list — applied to all weekdays
    return this.parseBusinessLunchFormat(paragraphs, week);
  }

  /**
   * The all-week section headings ("Veckans sallader", "Veckans 3 smörrebröd")
   * are emitted by the CMS as <p style="font-size: 16px"> siblings WITHOUT the
   * mobile-undersized-upper class, so a class-only query drops them and every
   * following block silently inherits the previous section's context — which
   * is how salmon and chicken salads ended up tagged vegetarian. Merge those
   * headings back in, keeping document order — but only the headings and the
   * empty spacer paragraphs: widening to every unclassed sibling also drags in
   * the contact block and the like, which then have to be blocklisted one by
   * one to stop them becoming dishes. Spacers have no text to mistake for a
   * dish and they are what closes a dish group, so an unclassed one has to
   * survive: drop it and the next line is swallowed by the preceding dish.
   */
  collectMenuParagraphs(allParagraphs, classedParagraphs) {
    const classed = new Set(classedParagraphs);
    const containers = new Set(classedParagraphs.map((p) => p.parentElement));
    return allParagraphs.filter((p) => {
      if (classed.has(p)) return true;
      if (!containers.has(p.parentElement)) return false;
      const text = p.textContent.trim();
      return !text || this.matchAllWeekHeader(text, p) !== null;
    });
  }

  /**
   * Tier 1: weekday headers (måndag/tisdag/...) with dishes under each, plus
   * all-week sections ("Veckans vegetariska/sallader/3 smörrebröd") whose
   * dishes are served every weekday.
   *
   * A dish is a GROUP of consecutive paragraphs, because the CMS wraps a long
   * dish name across several <p> elements and separates real dishes with
   * empty &nbsp;/<br> spacer paragraphs. Within a group:
   *  - a bold first line is the dish name and the following lines are its
   *    description (that is where "Innehåller: ..." belongs); and
   *  - an unbold group is one wrapped name, so continuation lines — which
   *    start lower-case, the site's own wrap signal — append to the name.
   * A spacer paragraph, a heading or an info line closes the group.
   */
  parseWeekdayFormat(paragraphs, week, allText) {
    // Tier 1 only claims a page that has weekday headers somewhere. Without
    // that guard the flat tier-2 layout would read its ordinary bold dish name
    // "Veckans 3 smörrebröd" as an all-week section heading. This is an
    // existence check, not an ordering one: an all-week heading sitting before
    // the first weekday header is honoured rather than skipped.
    if (!paragraphs.some((p) => this.matchWeekday(p.textContent.trim()))) {
      return [];
    }

    const price = this.extractPrice(allText);
    const dishes = [];

    let currentWeekday = null;
    let allWeekDietary = null; // non-null while inside an all-week section
    let skipRest = false;
    let group = null; // the dish being read; already appended to `dishes`

    for (const p of paragraphs) {
      const text = p.textContent.trim();
      if (!text) {
        group = null; // &nbsp;/<br> spacer paragraph — dish boundary
        continue;
      }

      // Skip the "Lunch vecka" / "Lunchmeny vecka" header
      if (/^lunch(?:meny)?\s+vecka/i.test(text)) {
        group = null;
        continue;
      }

      // Check if this is a weekday header
      const weekday = this.matchWeekday(text);
      if (weekday) {
        group = null;
        currentWeekday = weekday;
        allWeekDietary = null;
        skipRest = false;
        continue;
      }

      // All-week section header — its dishes are served every weekday
      const sectionDietary = this.matchAllWeekHeader(text, p);
      if (sectionDietary !== null) {
        group = null;
        currentWeekday = null;
        allWeekDietary = sectionDietary;
        skipRest = false;
        continue;
      }

      // Stop parsing at holiday markers or smörrebröd section
      if (/glad\s+påsk|god\s+jul|semesterstängt|stängt/i.test(text)) {
        group = null;
        skipRest = true;
        continue;
      }

      if (this.isInfoLine(text)) {
        group = null;
        continue;
      }
      // Break at start of catering/smörrebröd section — everything after is
      // noise. Note: "affärslunch" is deliberately unanchored so the boundary
      // fires on "Vårens affärsluncher i Malmö" as well.
      if (/^smörrebröd|affärslunch/i.test(text)) break;
      if (skipRest) continue;

      // Skip very short text or non-dish content (e.g. a stray ".")
      if (text.length < 5) continue;

      // Outside any weekday or all-week section there is nothing to attach to
      if (!currentWeekday && allWeekDietary === null) continue;

      const bold = this.hasBoldText(p);
      if (group && !bold) {
        if (group.bold) {
          // Description line under a bold dish name
          group.description = this.appendLine(group.description, text);
          continue;
        }
        if (!/^[A-ZÅÄÖ]/.test(text)) {
          // Wrapped continuation of an unbold dish name
          group.name = group.name.endsWith("/")
            ? `${group.name}${text}`
            : `${group.name} ${text}`;
          continue;
        }
      }

      group = {
        name: text,
        description: "",
        bold,
        days: currentWeekday ? [currentWeekday] : SWEDISH_WEEKDAYS,
        dietary: allWeekDietary ?? [],
      };
      dishes.push(group);
    }

    return this.expandDishes(dishes, week, price);
  }

  /**
   * The dietary tags for an all-week block heading, or null when `text` is not
   * one. "Veckans vegetariska" is matched unanchored for backwards
   * compatibility with the older markup; the other blocks ("Veckans sallader",
   * "Veckans 3 smörrebröd") are recognised only as bold headings so a dish name
   * that happens to open with "Veckans" is not mistaken for one.
   */
  matchAllWeekHeader(text, p) {
    if (/veckans\s+vegetarisk/i.test(text)) return ["vegetarian"];
    if (/^veckans\s+/i.test(text) && this.hasBoldText(p)) return [];
    return null;
  }

  /**
   * Fan each collected dish out to one lunch row per weekday it is served.
   * `days` defaults to the whole week: tiers 2 and 3 have no weekday grouping.
   */
  expandDishes(dishes, week, price) {
    const lunches = [];
    for (const dish of dishes) {
      for (const day of dish.days || SWEDISH_WEEKDAYS) {
        lunches.push(
          this.createLunchObject({
            name: dish.name,
            description: dish.description || "",
            price,
            weekday: day,
            week,
            ...(dish.dietary ? { dietary: dish.dietary } : {}),
          }),
        );
      }
    }
    return lunches;
  }

  /** Append a continuation line to an accumulating description. */
  appendLine(existing, text) {
    return existing ? `${existing} ${text}` : text;
  }

  /**
   * Tier 2: flat weekly list under a "Lunchmeny vecka N" heading. Dish names
   * are bold spans; the following non-bold line(s) are the description.
   * There is no weekday grouping — every dish is served all week, so each
   * dish is emitted for måndag–fredag (same pattern as the old "veckans
   * vegetariska" handling).
   */
  parseWeeklyListFormat(paragraphs, week) {
    const startIdx = paragraphs.findIndex((p) =>
      /lunch(?:meny)?\s+vecka/i.test(p.textContent),
    );
    if (startIdx === -1) return [];

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

      if (this.isInfoLine(text)) continue;

      // Boundary: the affärsluncher/catering block ends the weekly menu
      if (/affärslunch|avhämtning|catering/i.test(text)) break;

      if (this.hasBoldText(paragraphs[i])) {
        // Bold span = new dish name (handles bold nested in a non-bold span)
        if (currentDish) dishes.push(currentDish);
        currentDish = { name: text, description: "" };
      } else if (currentDish) {
        // Non-bold line following a dish = its description
        currentDish.description = this.appendLine(currentDish.description, text);
      }
    }
    if (currentDish) dishes.push(currentDish);

    return this.expandDishes(dishes, week, price);
  }

  /**
   * Tier 3: "Vårens affärsluncher i Malmö" numbered list ("1. Fläskfilé ...").
   * Used when no weekly lunch menu is published. Dishes apply to all
   * weekdays; price comes from the "Affärslunchen kostar 195kr" line.
   */
  parseBusinessLunchFormat(paragraphs, week) {
    const startIdx = paragraphs.findIndex((p) =>
      /affärslunch/i.test(p.textContent),
    );
    if (startIdx === -1) return [];

    let price = DEFAULT_BUSINESS_PRICE;
    const dishes = [];

    for (let i = startIdx + 1; i < paragraphs.length; i++) {
      const text = paragraphs[i].textContent.trim();
      if (!text) continue;

      // Numbered dish: "1. Fläskfilé med kålfrikassé & dragonrostade potatisar"
      const dishMatch = text.match(/^\d+\.\s*(.+)$/);
      if (dishMatch) {
        dishes.push({ name: dishMatch[1].trim() });
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

    return this.expandDishes(dishes, week, price);
  }

  /**
   * True for info lines that describe the menu rather than a dish, e.g.
   * "Välj mellan följande rätter", "Serveras mellan 11.00-14.00" or
   * "Ingår måltidsdryck...". These appear in both the weekday and the flat
   * weekly formats (bold or not), so both tiers must skip them. Contact
   * details ("bokning@freda49.se") are booking info, never a dish.
   */
  isInfoLine(text) {
    if (/\S+@\S+\.\w/.test(text)) return true;
    return /^(serveras\s+mellan|ingår|välj\s+mellan)/i.test(text);
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
