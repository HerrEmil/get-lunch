/**
 * Lokal 17 Restaurant Parser
 * Fetches weekly lunch menu PDF linked from lokal17.se and extracts dishes
 */

import { BaseParser } from "./base-parser.mjs";
import { SWEDISH_WEEKDAYS } from "./parser-interfaces.mjs";

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

const SITE_URL = "https://lokal17.se/";

/** Maps Swedish day prefixes in the PDF to our standard weekday names */
const DAY_PREFIXES = {
  måndag: "måndag",
  tisdag: "tisdag",
  onsdag: "onsdag",
  torsdag: "torsdag",
  fredag: "fredag",
};

export class Lokal17Parser extends BaseParser {
  constructor(config = {}) {
    super({
      name: "Lokal 17",
      url: SITE_URL,
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      ...config,
    });
  }

  getName() {
    return "Lokal 17";
  }

  getUrl() {
    return SITE_URL;
  }

  async parseMenu() {
    await this.logger.info("Starting Lokal 17 menu parsing");

    // 1. Fetch homepage and find PDF link
    const pdfUrl = await this.findPdfUrl();
    if (!pdfUrl) {
      throw new Error("Could not find Lunchmeny PDF link on lokal17.se");
    }

    await this.logger.info("Found PDF URL", { pdfUrl });

    // 2. Download PDF and extract text
    const text = await this.extractPdfText(pdfUrl);

    await this.logger.debug("Extracted PDF text", {
      length: text.length,
      preview: text.substring(0, 200),
    });

    // 3. Parse text into lunch objects
    const lunches = this.parseMenuText(text);

    await this.logger.info("Lokal 17 parsing completed", {
      totalLunches: lunches.length,
    });

    return lunches;
  }

  /**
   * Find the Lunchmeny PDF link from the homepage
   */
  async findPdfUrl() {
    const document = await this.fetchDocument();
    const links = document.querySelectorAll("a");

    for (const link of links) {
      const text = (link.textContent || "").trim();
      if (/lunchmeny/i.test(text)) {
        const href = link.getAttribute("href");
        if (!href) continue;
        // Resolve relative URLs
        return new URL(href, SITE_URL).toString();
      }
    }

    return null;
  }

  /**
   * Download a PDF and extract its text content
   */
  async extractPdfText(url) {
    const response = await this.makeRequest(url);
    const arrayBuffer = await response.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);

    const getDocument = await loadGetDocument();
    const pdf = await getDocument({ data, useSystemFonts: true, verbosity: 0 }).promise;
    const lines = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item) => item.str).join(" ");
      lines.push(pageText);
    }

    return this._fixUmlautGlyphs(lines.join("\n"));
  }

  /**
   * Repair umlaut glyphs mangled by PDF text extraction.
   *
   * This PDF's font maps the capital "Ä" glyph to the codepoint pair "A="
   * (the diaeresis is emitted as a stray "=" after the base letter). Lowercase
   * vowels and "Å" decode correctly, so only the uppercase diaeresis vowels are
   * affected. The PDF contains no legitimate "=" characters, so collapsing a
   * base vowel directly followed by "=" back into its umlaut form is safe.
   */
  _fixUmlautGlyphs(text) {
    return text
      .replace(/A=/g, "Ä")
      .replace(/O=/g, "Ö")
      .replace(/a=/g, "ä")
      .replace(/o=/g, "ö");
  }

  /**
   * Parse the extracted PDF text into lunch objects
   */
  parseMenuText(text) {
    const lunches = [];

    // Extract week number from "VECKA XX" or "vecka XX"
    const weekMatch = text.match(/vecka\s+(\d{1,2})/i);
    const week = weekMatch ? parseInt(weekMatch[1]) : this._getCurrentWeek();

    // Normalize whitespace
    const normalized = text.replace(/\s+/g, " ");

    // Build regex to split on day headers: "Måndag/Monday 150kr" etc.
    // Also match "Vegetarisk/Vegetarian 150kr"
    const dayPattern =
      /((?:måndag|tisdag|onsdag|torsdag|fredag|vegetarisk)\s*\/\s*\w+\s+(\d+)\s*kr)/gi;

    const sections = [];
    let match;
    while ((match = dayPattern.exec(normalized)) !== null) {
      sections.push({
        header: match[1],
        price: parseInt(match[2]),
        startIndex: match.index + match[0].length,
        dayKey: match[1].split("/")[0].trim().toLowerCase(),
      });
    }

    // Extract dish text between sections
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const endIndex =
        i + 1 < sections.length
          ? normalized.indexOf(sections[i + 1].header)
          : undefined;

      let dishText = normalized
        .substring(section.startIndex, endIndex)
        .trim();

      // Remove English translation line (typically in italics/second line)
      // The Swedish dish is first, English follows
      const lines = dishText
        .split(/(?<=[a-zåäö])\s+(?=[A-Z])/)
        .filter((l) => l.trim().length > 0);

      // Take the first meaningful line as the Swedish dish name
      let dishName = lines[0] || dishText;

      // Clean up: remove trailing English text if present
      // English translations typically start with a capital after the Swedish text
      // Pattern: "Swedish-dish English-dish" — split on the boundary
      const englishBoundary = dishName.match(
        /^(.+?(?:ris|majs|gratäng|purjolök|persilja|potatis|sås|puré|mos|bröd|sallad|grädde|lime|citron|svamp|lök|tomat|gurka|paprika|ost|skinka|fläsk|kyckling|nöt|fisk|lax|räka|torsk|soppa|gryta|biff|korv|köttbullar|pannkakor|crème|vanilj|choklad|äpple|päron|bär|sylt|kanel|kardemumma|ingefära|chili|vitlök|basilika|oregano|rosmarin|timjan|dill|mynta))\s+[A-Z]/,
      );
      if (englishBoundary) {
        dishName = englishBoundary[1];
      }

      // Clean up dish name
      dishName = dishName
        .replace(/\s+/g, " ")
        .replace(/^\s*[,.\-–]\s*/, "")
        .replace(/\s*[,.\-–]\s*$/, "")
        .trim();

      if (!dishName || dishName.length < 3) continue;

      const weekday = DAY_PREFIXES[section.dayKey];
      const isVegetarian = section.dayKey === "vegetarisk";

      // Vegetarian dish applies to all weekdays
      if (isVegetarian) {
        for (const day of SWEDISH_WEEKDAYS) {
          // Only add for days that have a daily dish (mon-thu based on PDF)
          const hasDailyDish = sections.some(
            (s) => DAY_PREFIXES[s.dayKey] === day,
          );
          if (hasDailyDish) {
            lunches.push(
              this.createLunchObject({
                name: dishName,
                price: section.price,
                weekday: day,
                week,
                dietary: ["vegetarian"],
              }),
            );
          }
        }
      } else if (weekday) {
        lunches.push(
          this.createLunchObject({
            name: dishName,
            price: section.price,
            weekday,
            week,
          }),
        );
      }
    }

    return lunches;
  }
}

export default Lokal17Parser;
