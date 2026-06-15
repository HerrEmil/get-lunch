/**
 * Ubåtshallen Parser
 * Extracts lunch menu from ubatshallen.se
 *
 * Structure: .entry-content contains <p> elements, but the weekday headers
 * are NOT reliably in their own paragraphs. In practice the source bleeds
 * content across paragraph boundaries, e.g.:
 *   - "Måndag" as its own <p>, dishes in the next <p>
 *   - A weekday label tacked onto the END of the previous day's dish <p>
 *     (e.g. "...sötsur såsOnsdag")
 *   - A closed day inlined after another day's dishes
 *     (e.g. "...stekt ägg Fredag Det gröna: Husman: STÄNGT ...")
 *
 * To be robust we concatenate all paragraph text, then split the whole blob
 * on weekday labels wherever they appear. Each weekday segment is parsed for
 * the three categories; segments marked STÄNGT (e.g. Midsummer) are skipped.
 *
 * Price appears as e.g. "129,-".
 */

import { BaseParser } from "./base-parser.mjs";

const WEEKDAYS = ["måndag", "tisdag", "onsdag", "torsdag", "fredag"];
const CATEGORIES = ["det gröna", "husman", "internationell"];

export class UbatshallenParser extends BaseParser {
  constructor(config = {}) {
    super({
      name: "Ubåtshallen",
      url: "https://www.ubatshallen.se/",
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      ...config,
    });
  }

  getName() {
    return "Ubåtshallen";
  }

  getUrl() {
    return "https://www.ubatshallen.se/";
  }

  async parseMenu() {
    try {
      await this.logger.info("Starting Ubåtshallen menu parsing");

      const document = await this.fetchDocument();
      const lunches = this.extractMenu(document);

      await this.logger.info("Ubåtshallen parsing completed", {
        totalLunches: lunches.length,
      });

      return lunches;
    } catch (error) {
      await this.logger.error("Ubåtshallen menu parsing failed", {}, error);
      throw error;
    }
  }

  extractMenu(document) {
    const lunches = [];

    // Always use current week — Ubåtshallen's week number is often incorrect
    const week = this._getCurrentWeek();

    // Extract price from page text
    const allText = document.body?.textContent || "";
    const priceMatch = allText.match(/(\d{2,3})\s*[,:]?\s*-/);
    const price = priceMatch ? parseInt(priceMatch[1]) : 129;

    // Get all paragraphs in entry-content
    const content = this.safeQuery(document, ".entry-content");
    if (!content) return lunches;

    // Concatenate all paragraph text. Weekday labels are unreliable as
    // standalone paragraphs (the source frequently appends the next day's
    // label to the previous day's dish paragraph, or inlines a closed day),
    // so we treat the whole content as one stream and split on weekday labels.
    const paragraphs = content.querySelectorAll("p");
    let blob = "";
    for (const p of paragraphs) {
      const text = p.textContent?.trim();
      if (!text) continue;
      blob += text + "\n";
    }

    const seen = new Set(); // dedupe weekday+category emissions

    for (const segment of this._splitByWeekday(blob)) {
      const { weekday, text } = segment;

      // Skip closed days (e.g. "STÄNGT — GLAD MIDSOMMAR" on Midsummer Eve).
      if (/stängt|stängd/i.test(text)) continue;

      if (!/det gröna|husman|internationell/i.test(text)) continue;

      const dishes = this.splitDishes(text);
      for (const dish of dishes) {
        const key = `${weekday}|${dish.category.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);

        lunches.push(
          this.createLunchObject({
            name: dish.category,
            description: dish.text,
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
   * Split a text blob into per-weekday segments. A weekday label may appear
   * at the start of a line or inline anywhere in the text. Each returned
   * segment holds the text from one weekday label up to the next.
   * @param {string} blob - Concatenated content text
   * @returns {Array<{weekday: string, text: string}>}
   */
  _splitByWeekday(blob) {
    // Match a capitalised weekday word as a standalone token. Allow it to be
    // glued to preceding lowercase text (e.g. "sötsur såsOnsdag") by not
    // requiring a leading boundary, but require it to be followed by a
    // non-letter (space, colon, newline, end) so we don't match e.g.
    // "Måndag" inside "Måndagsklubben".
    const pattern = new RegExp(
      `(${WEEKDAYS.join("|")})(?=[^a-zåäö]|$)`,
      "gi",
    );

    const matches = [];
    let m;
    while ((m = pattern.exec(blob)) !== null) {
      matches.push({ weekday: m[1].toLowerCase(), index: m.index, end: pattern.lastIndex });
    }

    const segments = [];
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].end;
      const stop = i + 1 < matches.length ? matches[i + 1].index : blob.length;
      segments.push({
        weekday: matches[i].weekday,
        text: blob.slice(start, stop).trim(),
      });
    }

    return segments;
  }

  splitDishes(text) {
    const dishes = [];
    // Split on category labels: "Det gröna:", "Husman:", "Internationell:"
    const regex =
      /(Det gröna|Husman|Internationell)\s*:\s*/gi;
    const parts = text.split(regex).filter((s) => s.trim());

    for (let i = 0; i < parts.length - 1; i += 2) {
      const category = parts[i].trim();
      const dishText = parts[i + 1].trim();
      if (dishText) {
        dishes.push({ category, text: dishText });
      }
    }

    return dishes;
  }
}

export default UbatshallenParser;
