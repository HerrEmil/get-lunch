/**
 * ICA Maxi Västra Hamnen Parser
 * Extracts lunch menu from ICA's daily lunch page.
 *
 * Structure: page contains "Dagens lunch v.XX" heading,
 * then <strong> weekday headers followed by <p> dish descriptions.
 * One dish per day, no price listed on the page.
 */

import { BaseParser } from "./base-parser.mjs";

const WEEKDAYS = ["måndag", "tisdag", "onsdag", "torsdag", "fredag"];

export class IcaParser extends BaseParser {
  constructor(config = {}) {
    super({
      name: "ICA Maxi Västra Hamnen",
      url: "https://www.ica.se/butiker/maxi/malmo/maxi-ica-stormarknad-vastra-hamnen-1003569/tjanster/dagens-lunch/",
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      ...config,
    });
  }

  getName() {
    return "ICA Maxi Västra Hamnen";
  }

  getUrl() {
    return "https://www.ica.se/butiker/maxi/malmo/maxi-ica-stormarknad-vastra-hamnen-1003569/tjanster/dagens-lunch/";
  }

  async parseMenu() {
    try {
      await this.logger.info("Starting ICA menu parsing");

      const document = await this.fetchDocument();
      const lunches = this.extractMenu(document);

      await this.logger.info("ICA parsing completed", {
        totalLunches: lunches.length,
      });

      return lunches;
    } catch (error) {
      await this.logger.error("ICA menu parsing failed", {}, error);
      throw error;
    }
  }

  extractMenu(document) {
    const lunches = [];
    const week = this.extractWeekNumber(document) || this._getCurrentWeek();
    const bodyText = document.body?.textContent || "";

    // Try to find a price on the page
    const priceMatch = bodyText.match(/(\d{2,3})\s*kr/i);
    const price = priceMatch ? parseInt(priceMatch[1]) : 80;

    // Find all <strong> elements — weekday headers
    const strongElements = document.querySelectorAll("strong");

    for (const strong of strongElements) {
      const strongText = strong.textContent?.trim().toLowerCase();
      const weekday = WEEKDAYS.find((wd) => strongText?.startsWith(wd));
      if (!weekday) continue;

      // Collect text from following sibling elements until next <strong> or end
      const description = this.collectDishText(strong);
      if (!description || /ingen.*lunch|stängt|stängd/i.test(description)) {
        continue;
      }

      lunches.push(
        this.createLunchObject({
          name: description,
          description: "",
          price,
          weekday,
          week,
          place: this.getName(),
        }),
      );
    }

    return lunches;
  }

  collectDishText(strongElement) {
    const parts = [];
    let node = strongElement.parentElement?.nextElementSibling;

    // If strong is inside a <p>, the dish text may be in the next <p>
    // Or it could be a text node following the <strong> within the same parent
    const parent = strongElement.parentElement;
    if (parent) {
      // Check for text after <strong> within the same element
      const parentText = parent.textContent?.trim() || "";
      const strongText = strongElement.textContent?.trim() || "";
      const afterStrong = parentText.slice(parentText.indexOf(strongText) + strongText.length).trim();
      if (afterStrong) {
        return afterStrong;
      }

      // Otherwise look at the next sibling element
      node = parent.nextElementSibling;
    }

    while (node) {
      // Stop if we hit another weekday header
      const nextStrong = node.querySelector?.("strong") || (node.tagName === "STRONG" ? node : null);
      if (nextStrong) {
        const text = nextStrong.textContent?.trim().toLowerCase();
        if (WEEKDAYS.some((wd) => text?.startsWith(wd))) break;
      }

      const text = node.textContent?.trim();
      if (text) parts.push(text);

      node = node.nextElementSibling;
    }

    return parts.join(" ").trim();
  }

  extractWeekNumber(document) {
    const text = document.body?.textContent || "";
    const match = text.match(/v(?:ecka)?[.\s]*(\d{1,2})/i);
    return match ? parseInt(match[1]) : null;
  }
}

export default IcaParser;
