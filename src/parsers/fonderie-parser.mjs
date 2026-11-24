/**
 * La Fonderie Restaurant Parser
 * Extends BaseParser to extract lunch menu data from La Fonderie
 */

import { BaseParser } from "./base-parser.mjs";
import { SWEDISH_WEEKDAYS } from "./parser-interfaces.mjs";

export class FonderieParser extends BaseParser {
  constructor(config = {}) {
    super({
      name: "La Fonderie",
      url: "https://www.lafonderie.se/lunch",
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      ...config,
    });
  }

  getName() {
    return "La Fonderie";
  }

  getUrl() {
    return "https://www.lafonderie.se/lunch";
  }

  async parseMenu() {
    try {
      await this.logger.info("Starting La Fonderie menu parsing");

      const document = await this.fetchDocument();

      const week = this.extractWeekNumber(document);
      const dishes = this.extractWeeklyDishes(document);

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

      await this.logger.info("La Fonderie parsing completed", {
        totalLunches: lunches.length,
      });

      return lunches;
    } catch (error) {
      await this.logger.error("La Fonderie menu parsing failed", {}, error);
      throw error;
    }
  }

  /**
   * Extract week number from H1 matching /LE LUNCH v\.(\d+)/
   */
  extractWeekNumber(document) {
    const headings = this.safeQuery(document, "h1", true);
    if (!headings) return this._getCurrentWeek();

    for (const h1 of headings) {
      const text = this.extractText(h1);
      const match = text.match(/LE LUNCH v\.(\d+)/i);
      if (match) {
        return parseInt(match[1]);
      }
    }

    return this._getCurrentWeek();
  }

  /**
   * Extract weekly dishes from the VECKANS section.
   * Supports two layouts:
   *  - single <p> per dish: "<strong>Name – 195</strong><br>Description"
   *  - pairs of <p> elements: first = dish name, second = description + price
   */
  extractWeeklyDishes(document) {
    const dishes = [];

    // Find the H4 "VECKANS" section
    const h4Elements = this.safeQuery(document, "h4", true);
    if (!h4Elements) return dishes;

    let veckansHeading = null;
    for (const h4 of h4Elements) {
      const text = this.extractText(h4).toUpperCase();
      if (text.includes("VECKANS")) {
        veckansHeading = h4;
        break;
      }
    }

    if (!veckansHeading) return dishes;

    // Price at end of a line: dash (hyphen/en/em) + amount, optional "kr"
    // (the site dropped "kr" at some point), e.g. "… – 195" or "… - 195 kr".
    const PRICE_RE = /\s*[-–—]\s*(\d+)\s*(?:kr)?\s*$/;

    // Walk <p> elements after the VECKANS heading until the next heading.
    // Single-paragraph dishes are emitted directly; other non-empty lines are
    // collected for pair parsing, with a null break so pairs never span a
    // single-paragraph dish.
    const paragraphs = [];
    let sibling = veckansHeading.nextElementSibling;
    while (sibling) {
      const tag = sibling.tagName.toLowerCase();
      if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4") break;

      if (tag === "p") {
        const single = this._parseSingleParagraphDish(sibling, PRICE_RE);
        if (single) {
          dishes.push(single);
          paragraphs.push(null);
        } else {
          const text = this.extractText(sibling);
          if (text) {
            paragraphs.push(text);
          }
        }
      }

      sibling = sibling.nextElementSibling;
    }

    // Parse pairs of paragraphs: name + description with price
    // Skip lines that are general notes (e.g., "Alla rätter serveras med...")
    let i = 0;
    while (i < paragraphs.length - 1) {
      const nameLine = paragraphs[i];
      const descLine = paragraphs[i + 1];
      if (nameLine === null || descLine === null) {
        i += 1;
        continue;
      }

      const priceMatch = descLine.match(PRICE_RE);

      if (priceMatch) {
        dishes.push({
          name: nameLine,
          description: descLine.replace(PRICE_RE, "").trim(),
          price: parseInt(priceMatch[1]),
        });
        i += 2;
      } else {
        // Not a dish pair, skip this line
        i += 1;
      }
    }

    return dishes;
  }

  /**
   * Parse "<p>Name – 195<br>Description</p>": the text before the first <br>
   * must end with a price. Returns null when the paragraph is not that shape.
   */
  _parseSingleParagraphDish(paragraph, priceRe) {
    const br = paragraph.querySelector("br");
    if (!br) return null;

    let head = "";
    let tail = "";
    let afterBr = false;
    const walk = (node) => {
      for (const child of node.childNodes) {
        if (child === br) {
          afterBr = true;
        } else if (child.nodeType === 3) {
          if (afterBr) tail += child.textContent;
          else head += child.textContent;
        } else if (child.nodeName === "BR") {
          if (afterBr) tail += " ";
          else head += " ";
        } else {
          walk(child);
        }
      }
    };
    walk(paragraph);

    head = head.replace(/\s+/g, " ").trim();
    const priceMatch = head.match(priceRe);
    if (!priceMatch) return null;

    const name = head.replace(priceRe, "").trim();
    if (!name) return null;

    return {
      name,
      description: tail.replace(/\s+/g, " ").trim(),
      price: parseInt(priceMatch[1]),
    };
  }
}

export default FonderieParser;
