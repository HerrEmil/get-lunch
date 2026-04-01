/**
 * Fisky Business Restaurant Parser
 * Fetches weekly lunch menu PDF linked from fiskybusiness.nu and extracts dishes
 */

import { BaseParser } from "./base-parser.mjs";
import { SWEDISH_WEEKDAYS } from "./parser-interfaces.mjs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const SITE_URL = "https://fiskybusiness.nu/dockan-malmouml.html";
const BASE_URL = "https://fiskybusiness.nu";

export class FiskyParser extends BaseParser {
  constructor(config = {}) {
    super({
      name: "Fisky Business",
      url: SITE_URL,
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      ...config,
    });
  }

  getName() {
    return "Fisky Business";
  }

  getUrl() {
    return SITE_URL;
  }

  async parseMenu() {
    await this.logger.info("Starting Fisky Business menu parsing");

    // 1. Fetch page and find PDF link
    const pdfUrl = await this.findPdfUrl();
    if (!pdfUrl) {
      throw new Error(
        "Could not find lunch vecka PDF link on fiskybusiness.nu",
      );
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

    await this.logger.info("Fisky Business parsing completed", {
      totalLunches: lunches.length,
    });

    return lunches;
  }

  /**
   * Find the lunch vecka PDF link from the page
   */
  async findPdfUrl() {
    const document = await this.fetchDocument();
    const links = document.querySelectorAll("a");

    for (const link of links) {
      const text = (link.textContent || "").trim();
      if (/lunch vecka/i.test(text)) {
        const href = link.getAttribute("href");
        if (!href) continue;
        return new URL(href, BASE_URL).toString();
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

    const pdf = await getDocument({ data, useSystemFonts: true }).promise;
    const lines = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item) => item.str).join(" ");
      lines.push(pageText);
    }

    return lines.join("\n");
  }

  /**
   * Parse the extracted PDF text into lunch objects
   */
  parseMenuText(text) {
    const lunches = [];

    // Extract week number from "Vecka XX"
    const weekMatch = text.match(/vecka\s+(\d{1,2})/i);
    const week = weekMatch ? parseInt(weekMatch[1]) : this._getCurrentWeek();

    // Extract price from "XXX kr"
    const priceMatch = text.match(/(\d+)\s*kr/i);
    const price = priceMatch ? parseInt(priceMatch[1]) : 0;

    // Normalize whitespace
    const normalized = text.replace(/\s+/g, " ");

    // Extract FISK section
    const fishMatch = normalized.match(/FISK\s+(.*?)(?=KÖTT)/i);
    const fishText = fishMatch ? fishMatch[1].trim() : "";

    // Split fish into mon-tue and wed-fri
    let fishMonTue = "";
    let fishWedFri = "";

    if (fishText) {
      const monTueMatch = fishText.match(
        /MÅNDAG\s*-\s*TISDAG\s+(.*?)(?=ONSDAG\s*-\s*FREDAG)/i,
      );
      const wedFriMatch = fishText.match(/ONSDAG\s*-\s*FREDAG\s+(.*)/i);

      fishMonTue = monTueMatch ? monTueMatch[1].trim() : "";
      fishWedFri = wedFriMatch ? wedFriMatch[1].trim() : "";
    }

    // Extract KÖTT HELA VECKAN dish
    const meatMatch = normalized.match(
      /KÖTT\s+HELA\s+VECKAN\s+(.*?)(?=VEG\s+HELA\s+VECKAN)/i,
    );
    const meatDish = meatMatch ? meatMatch[1].trim() : "";

    // Extract VEG HELA VECKAN dish
    const vegMatch = normalized.match(/VEG\s+HELA\s+VECKAN\s+(.*)/i);
    const vegDish = vegMatch ? vegMatch[1].trim() : "";

    // Fish mon-tue → måndag, tisdag
    if (fishMonTue) {
      for (const day of ["måndag", "tisdag"]) {
        lunches.push(
          this.createLunchObject({
            name: fishMonTue,
            price,
            weekday: day,
            week,
          }),
        );
      }
    }

    // Fish wed-fri → onsdag, torsdag, fredag
    if (fishWedFri) {
      for (const day of ["onsdag", "torsdag", "fredag"]) {
        lunches.push(
          this.createLunchObject({
            name: fishWedFri,
            price,
            weekday: day,
            week,
          }),
        );
      }
    }

    // Meat → all weekdays
    if (meatDish) {
      for (const day of SWEDISH_WEEKDAYS) {
        lunches.push(
          this.createLunchObject({
            name: meatDish,
            price,
            weekday: day,
            week,
          }),
        );
      }
    }

    // Veg → all weekdays with dietary vegetarian
    if (vegDish) {
      for (const day of SWEDISH_WEEKDAYS) {
        lunches.push(
          this.createLunchObject({
            name: vegDish,
            price,
            weekday: day,
            week,
            dietary: ["vegetarian"],
          }),
        );
      }
    }

    return lunches;
  }
}

export default FiskyParser;
