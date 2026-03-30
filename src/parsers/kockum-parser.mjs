/**
 * Kockum Fritid Restaurant Parser (FreDa49)
 * Extracts lunch menu from FreDa49's lunch page at Kockum Fritid
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
    const lunches = [];

    // Extract week number from "Lunch vecka 14/2026" pattern
    const allText = document.body?.textContent || "";
    const weekMatch = allText.match(/[Ll]unch\s+vecka\s+(\d+)/);
    const week = weekMatch ? parseInt(weekMatch[1]) : this._getCurrentWeek();

    // Extract price from H1 containing "136kr" or similar
    const price = this.extractPrice(allText);

    // All content is in <p class="mobile-undersized-upper"> elements
    const paragraphs = document.querySelectorAll("p.mobile-undersized-upper");
    if (!paragraphs || paragraphs.length === 0) return lunches;

    let currentWeekday = null;
    let isVegetarian = false;
    let skipRest = false;

    for (const p of paragraphs) {
      const text = p.textContent.trim();
      if (!text) continue;

      // Skip the "Lunch vecka" header
      if (/^lunch\s+vecka/i.test(text)) continue;

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
      if (/^smörrebröd/i.test(text)) break;
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

  extractPrice(text) {
    const match = text.match(/(\d{2,3})\s*kr/i);
    return match ? parseInt(match[1]) : 136;
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
