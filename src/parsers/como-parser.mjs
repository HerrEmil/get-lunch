/**
 * COMO Restaurant Parser
 * Extends BaseParser to extract lunch menu data from COMO Malmö
 */

import { BaseParser } from "./base-parser.mjs";
import { SWEDISH_WEEKDAYS } from "./parser-interfaces.mjs";

export class ComoParser extends BaseParser {
  constructor(config = {}) {
    super({
      name: "COMO",
      // The lunch menu is rendered on the homepage (in a menu overlay).
      // The old /meny path now returns a "Nothing Found" page with no menu.
      url: "https://comomalmo.se/",
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      ...config,
    });
  }

  getName() {
    return "COMO";
  }

  getUrl() {
    return "https://comomalmo.se/";
  }

  async parseMenu() {
    try {
      await this.logger.info("Starting COMO menu parsing");

      const document = await this.fetchDocument();

      const week = this.extractWeekNumber(document);
      const dishes = this.extractDishes(document);

      const lunches = [];
      for (const { name, description, price } of dishes) {
        for (const weekday of SWEDISH_WEEKDAYS) {
          lunches.push(
            this.createLunchObject({
              name,
              description,
              price,
              weekday,
              week,
              place: this.getName(),
            }),
          );
        }
      }

      await this.logger.info("COMO parsing completed", {
        totalLunches: lunches.length,
      });

      return lunches;
    } catch (error) {
      await this.logger.error("COMO menu parsing failed", {}, error);
      throw error;
    }
  }

  /**
   * Extract week number from text matching "V.XX" or "Vecka XX"
   */
  extractWeekNumber(document) {
    const body = document.body;
    if (!body) return this._getCurrentWeek();

    const text = this.extractText(body);
    const match = text.match(/(?:V\.|Vecka)\s*(\d+)/i);
    if (match) {
      return parseInt(match[1]);
    }

    return this._getCurrentWeek();
  }

  /**
   * Extract dishes from the lunch menu section.
   * The heading varies by season — "Lunchmeny V.XX" in winter, "Sommarlunch"
   * in summer — but always contains "lunch", unlike the evening/dessert/drink
   * sections ("Sommarmeny", "meny kväll", "sött", "Vin", ...).
   *
   * Both templates share the same structure: H2 heading → UL → LI, where each
   * LI holds a DIV with an H3 (category like "Kött" in winter, dish name like
   * "Sallad Niçoise" in summer) plus description P(s), and a trailing price P
   * as a direct child of the LI. Items without a description (desserts,
   * snacks) are not lunch dishes and are skipped.
   *
   * UNTITLED ITEMS (seen from 2026-08): the same summer template is now
   * published with an EMPTY H3 and the whole dish in the description P
   * ("sallad niçoise, halstrad tonfisk, ägg, haricot vertes, tomat &
   * sardell", 195). Those are real, priced lunch dishes, so we mirror what is
   * published: the description text becomes the dish name and no separate
   * description is claimed. A non-empty H3 still wins, so the titled markup
   * keeps parsing exactly as before. Nothing is invented — an item with no
   * text at all is still skipped.
   */
  extractDishes(document) {
    const dishes = [];

    const headings = this.safeQuery(document, "h2", true);
    if (!headings) return dishes;

    let lunchHeading = null;
    for (const heading of headings) {
      if (this.extractText(heading).toLowerCase().includes("lunch")) {
        lunchHeading = heading;
        break;
      }
    }

    if (!lunchHeading) return dishes;

    // The menu is in the UL immediately after the heading
    const ul = lunchHeading.nextElementSibling;
    if (!ul || ul.tagName.toLowerCase() !== "ul") return dishes;

    const items = this.safeQuery(ul, "li", true);
    if (!items) return dishes;

    for (const li of items) {
      const h3 = this.safeQuery(li, "h3");
      if (!h3) continue;

      const rawName = this.extractText(h3).replace(/\s+/g, " ").trim();

      // Description P(s) sit next to the H3 inside the wrapper DIV; the
      // price P is a direct child of the LI, outside that DIV.
      const wrapper = h3.parentElement;
      const descriptionEls =
        wrapper && wrapper !== li ? this.safeQuery(wrapper, "p", true) : null;
      if (!descriptionEls) continue;

      const description = Array.from(descriptionEls)
        .map((p) => this.extractText(p))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (!description) continue;

      let price = null;
      for (const child of li.children) {
        if (child.tagName.toLowerCase() !== "p") continue;
        const priceMatch = this.extractText(child).match(/\d{2,3}/);
        if (priceMatch) price = parseInt(priceMatch[0]);
      }
      if (price === null) continue;

      // Untitled item: the published dish text is the only name there is.
      const name = rawName || description;
      dishes.push({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        description: rawName ? description : "",
        price,
      });
    }

    return dishes;
  }
}

export default ComoParser;
