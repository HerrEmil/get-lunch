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

    // 2. Download PDF and extract positioned text items
    const items = await this.extractPdfItems(pdfUrl);

    await this.logger.debug("Extracted PDF items", {
      count: items.length,
    });

    // 3. Parse items into lunch objects
    const lunches = this.parsePdfItems(items);

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
   * Download a PDF and extract positioned text items
   */
  async extractPdfItems(url) {
    const response = await this.makeRequest(url);
    const arrayBuffer = await response.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);

    const pdf = await getDocument({ data, useSystemFonts: true }).promise;
    const page = await pdf.getPage(1);
    const content = await page.getTextContent();

    return content.items
      .filter((item) => item.str.trim())
      .map((item) => ({
        text: item.str.trim(),
        x: Math.round(item.transform[4]),
        y: Math.round(item.transform[5]),
      }));
  }

  /**
   * Parse positioned PDF text items into lunch objects.
   *
   * The PDF has a two-column layout:
   *   Left (x≈38):  MÅNDAG-TISDAG fish, KÖTT HELA VECKAN meat
   *   Right (x≈340): ONSDAG-FREDAG fish, VEG HELA VECKAN veg
   *
   * We group items by column (left/right based on x), then extract
   * dish text from the known vertical regions.
   */
  parsePdfItems(items) {
    const lunches = [];

    // Extract metadata from all items
    const allText = items.map((i) => i.text).join(" ");
    const weekMatch = allText.match(/Vecka\s+(\d{1,2})/i);
    const week = weekMatch ? parseInt(weekMatch[1]) : this._getCurrentWeek();

    const priceMatch = allText.match(/(\d+)\s*kr/i);
    const price = priceMatch ? parseInt(priceMatch[1]) : 0;

    if (price === 0) return lunches;

    // Split into left and right columns based on x position
    // Markers and dish text below y≈500 (below the FISK header)
    const contentItems = items.filter((i) => i.y < 500);
    const midX = 200;
    const leftItems = contentItems.filter((i) => i.x < midX);
    const rightItems = contentItems.filter((i) => i.x >= midX);

    // Sort by y descending (top of page = higher y)
    const sortByY = (a, b) => b.y - a.y;
    leftItems.sort(sortByY);
    rightItems.sort(sortByY);

    // Extract dish text: skip marker lines, collect dish description lines
    const leftDishes = this._extractColumnDishes(leftItems);
    const rightDishes = this._extractColumnDishes(rightItems);

    // Left column: fish mon-tue (top) and meat (bottom)
    // Right column: fish wed-fri (top) and veg (bottom)
    const fishMonTue = leftDishes[0] || "";
    const meatDish = leftDishes[1] || "";
    const fishWedFri = rightDishes[0] || "";
    const vegDish = rightDishes[1] || "";

    if (fishMonTue) {
      for (const day of ["måndag", "tisdag"]) {
        lunches.push(
          this.createLunchObject({ name: fishMonTue, price, weekday: day, week }),
        );
      }
    }

    if (fishWedFri) {
      for (const day of ["onsdag", "torsdag", "fredag"]) {
        lunches.push(
          this.createLunchObject({ name: fishWedFri, price, weekday: day, week }),
        );
      }
    }

    if (meatDish) {
      for (const day of SWEDISH_WEEKDAYS) {
        lunches.push(
          this.createLunchObject({ name: meatDish, price, weekday: day, week }),
        );
      }
    }

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

  /**
   * Extract dish descriptions from a column's text items.
   * Skips marker text (MÅNDAG, TISDAG, ONSDAG, FREDAG, KÖTT, VEG, HELA VECKAN, VECKANS).
   * Groups consecutive non-marker lines into dishes.
   */
  _extractColumnDishes(items) {
    const markerPattern =
      /^(MÅNDAG|TISDAG|ONSDAG|FREDAG|KÖTT|VEG|FISK|HELA VECKAN|VECKANS)/i;

    const dishes = [];
    let current = [];

    for (const item of items) {
      if (markerPattern.test(item.text)) {
        if (current.length > 0) {
          dishes.push(current.join(" "));
          current = [];
        }
      } else {
        current.push(item.text);
      }
    }

    if (current.length > 0) {
      dishes.push(current.join(" "));
    }

    return dishes;
  }
}

export default FiskyParser;
