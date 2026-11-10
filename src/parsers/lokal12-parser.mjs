/**
 * Lokal 12 Restaurant Parser
 * Fetches the weekly lunch menu PDF linked from lokal12.se and extracts dishes
 */

import { BaseParser } from "./base-parser.mjs";

let _getDocument;
async function loadGetDocument() {
  if (!_getDocument) {
    // Install DOMMatrix/ImageData/Path2D before pdfjs loads — Lambda has no
    // @napi-rs/canvas to polyfill them. See src/lib/pdf-globals.mjs.
    await import("../lib/pdf-globals.mjs");
    ({ getDocument: _getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs"));
  }
  return _getDocument;
}

const SITE_URL = "https://lokal12.se/";

const DAY_HEADER = /^(måndag|tisdag|onsdag|torsdag|fredag)\s*\|/i;
const VEGETARIAN_HEADER = /^veckans vegetariska\b/i;
const DAILY_PRICE_HEADER = /^klassisk\s+(\d+)\s*kr/i;
const SECTION_END = /^(alla dagar|alltid hos)/i;
const CLOSED = /stängt|röd dag|closed/i;

export class Lokal12Parser extends BaseParser {
  constructor(config = {}) {
    super({
      name: "Lokal 12",
      url: SITE_URL,
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      ...config,
    });
  }

  getName() {
    return "Lokal 12";
  }

  getUrl() {
    return SITE_URL;
  }

  async parseMenu() {
    await this.logger.info("Starting Lokal 12 menu parsing");

    const pdfUrl = await this.findPdfUrl();
    if (!pdfUrl) {
      throw new Error("Could not find Lunchmeny PDF link on lokal12.se");
    }
    await this.logger.info("Found PDF URL", { pdfUrl });

    const lines = await this.extractPdfLines(pdfUrl);
    const lunches = this.parseMenuLines(lines);

    await this.logger.info("Lokal 12 parsing completed", {
      totalLunches: lunches.length,
    });

    return lunches;
  }

  async findPdfUrl() {
    const document = await this.fetchDocument();

    for (const link of document.querySelectorAll("a")) {
      const href = link.getAttribute("href");
      if (href && /\.pdf/i.test(href) && /lunchmeny/i.test(link.textContent || "")) {
        return new URL(href, SITE_URL).toString();
      }
    }

    return null;
  }

  async extractPdfLines(url) {
    const response = await this.makeRequest(url);
    const data = new Uint8Array(await response.arrayBuffer());

    const getDocument = await loadGetDocument();
    const pdf = await getDocument({ data, useSystemFonts: true, verbosity: 0 }).promise;
    const lines = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      lines.push(...this.itemsToLines(content.items));
    }

    return lines;
  }

  /**
   * Rebuild visual lines from PDF text items, which arrive in reading order.
   * Items on one line are concatenated without a separator because the PDF
   * splits words around ligatures ("Grillbu" + "ff" + "é").
   */
  itemsToLines(items) {
    const lines = [];
    let current = "";
    let currentY = null;

    for (const item of items) {
      if (!item.str) continue;
      const y = item.transform[5];
      if (currentY !== null && Math.abs(y - currentY) > 2) {
        lines.push(current);
        current = "";
      }
      current += item.str;
      currentY = y;
    }
    if (current) lines.push(current);

    return lines.map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  }

  parseMenuLines(lines) {
    const weekMatch = lines.join(" ").match(/vecka\s+(\d{1,2})/i);
    const week = weekMatch ? parseInt(weekMatch[1]) : this._getCurrentWeek();

    const sections = [];
    let dailyPrice = 0;
    let section = null;

    for (const line of lines) {
      const priceMatch = line.match(DAILY_PRICE_HEADER);
      const dayMatch = line.match(DAY_HEADER);

      if (priceMatch) {
        dailyPrice = parseInt(priceMatch[1]);
        section = null;
      } else if (dayMatch) {
        section = { weekday: dayMatch[1].toLowerCase(), price: dailyPrice, lines: [] };
        sections.push(section);
      } else if (VEGETARIAN_HEADER.test(line)) {
        const price = line.match(/(\d+)\s*kr/i);
        section = { vegetarian: true, price: price ? parseInt(price[1]) : dailyPrice, lines: [] };
        sections.push(section);
      } else if (SECTION_END.test(line)) {
        section = null;
      } else if (section) {
        section.lines.push(line);
      }
    }

    const lunches = [];
    const servedDays = [];

    for (const { weekday, price, lines: dishLines, vegetarian } of sections) {
      const name = this.swedishDishName(dishLines);
      if (vegetarian || !name || name.length < 3 || CLOSED.test(name)) continue;
      servedDays.push(weekday);
      lunches.push(this.createLunchObject({ name, price, weekday, week }));
    }

    // The weekly vegetarian dish is served on every day with a daily dish
    const vegetarianSection = sections.find((s) => s.vegetarian);
    const vegetarianName = vegetarianSection && this.swedishDishName(vegetarianSection.lines);
    if (vegetarianName) {
      for (const weekday of servedDays) {
        lunches.push(
          this.createLunchObject({
            name: vegetarianName,
            price: vegetarianSection.price,
            weekday,
            week,
            dietary: ["vegetarian"],
          }),
        );
      }
    }

    return lunches;
  }

  /**
   * Each dish is written in Swedish, then English, with no marker between
   * them and no consistent font. Swedish continuation lines start lowercase
   * and the English translation starts uppercase, so the name ends at the
   * first capitalised line after the first.
   */
  swedishDishName(lines) {
    if (lines.length === 0) return "";

    const parts = [lines[0]];
    for (const line of lines.slice(1)) {
      if (/^\p{Lu}/u.test(line)) break;
      parts.push(line);
    }

    return parts
      .reduce((name, part) => (name.endsWith("-") ? name + part : `${name} ${part}`))
      .replace(/\s+/g, " ")
      .trim();
  }
}

export default Lokal12Parser;
