/**
 * Niagara Restaurant Parser
 * Extends BaseParser to extract lunch menu data from Restaurang Niagara
 */

import { BaseParser } from "./base-parser.mjs";
import { createLunchObject } from "./parser-interfaces.mjs";
import { SWEDISH_WEEKDAYS } from "./parser-interfaces.mjs";

export class NiagaraParser extends BaseParser {
  constructor(config = {}) {
    super({
      name: "Niagara",
      url: "https://restaurangniagara.se/lunch/",
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      ...config,
    });

    // Niagara-specific selectors
    this.selectors = {
      // Container selectors (try multiple fallbacks)
      containers: [
        "div.lunch",
        "section",
        ".lunch-menu",
        "main",
        ".content",
        "#content",
        "body",
      ],

      // Week number selectors
      weekSelectors: ["h3", ".week-header", ".week-number", "[class*='week']"],

      // Table-based structure selectors
      tableSelectors: {
        table: "table",
        rows: "tbody tr, tr",
        cells: "td, th",
      },

      // Modern structure selectors
      modernSelectors: {
        weekdayHeaders: ["h3", "h4", ".day-header", ".tab-header"],
        tabPanels: [
          "[role='tabpanel']",
          "[data-day]",
          "[data-weekday]",
          ".tab-content",
        ],
        daySections: [
          ".{{weekday}}",
          ".day-{{weekday}}",
          "[class*='{{weekday}}']",
          "#{{weekday}}",
          "#day-{{weekday}}",
        ],
        lunchItems: [".lunch-item", ".meal", ".dish", ".menu-item"],
      },
    };
  }

  getName() {
    return "Niagara";
  }

  getUrl() {
    return "https://restaurangniagara.se/lunch/";
  }

  async parseMenu() {
    try {
      await this.logger.info("Starting Niagara menu parsing");

      // Fetch the webpage
      const document = await this.fetchDocument();

      // Find the lunch container
      const container = await this.findLunchContainer(document);
      if (!container) {
        throw new Error("Could not find lunch container with any selector");
      }

      // Extract all lunch data
      const lunches = await this.extractAllLunchData(container);

      await this.logger.info("Niagara parsing completed", {
        totalLunches: lunches.length,
        uniqueWeekdays: [...new Set(lunches.map((l) => l.weekday))].length,
      });

      return lunches;
    } catch (error) {
      await this.logger.error("Niagara menu parsing failed", {}, error);
      throw error;
    }
  }

  /**
   * Find the lunch container using multiple selector strategies
   */
  async findLunchContainer(document) {
    for (const [index, selector] of this.selectors.containers.entries()) {
      try {
        await this.logger.debug(
          `Attempting container selector ${index + 1}/${this.selectors.containers.length}: ${selector}`,
        );

        const container = this.safeQuery(document, selector);
        if (container && this.isValidContainer(container)) {
          await this.logger.info(
            `Successfully found valid container with selector: ${selector}`,
            {
              childElementsCount: container.children
                ? container.children.length
                : 0,
              textContentLength: container.textContent
                ? container.textContent.length
                : 0,
            },
          );
          return container;
        }

        await this.logger.debug(`Selector ${selector} returned null/undefined`);
      } catch (error) {
        await this.logger.warn(
          `Selector ${selector} failed with error: ${error.message}`,
        );
      }
    }

    return null;
  }

  /**
   * Validate that a container likely contains lunch data
   */
  isValidContainer(container) {
    if (!container) return false;

    const text = this.extractText(container).toLowerCase();
    const hasLunchKeywords =
      text.includes("lunch") ||
      text.includes("meny") ||
      text.includes("vecka") ||
      text.includes("måndag") ||
      text.includes("tisdag");

    const hasContent = container.children && container.children.length > 0;
    const hasReasonableLength = text.length > 10;

    return hasContent && hasReasonableLength && hasLunchKeywords;
  }

  /**
   * Extract all lunch data from the container
   */
  async extractAllLunchData(container) {
    const lunches = [];

    try {
      // First try table-based extraction
      const tableLunches = await this.extractFromTableStructure(container);
      if (tableLunches.length > 0) {
        lunches.push(...tableLunches);
        await this.logger.info("Successfully extracted from table structure", {
          itemCount: tableLunches.length,
        });
      } else {
        // Fallback to modern structure extraction
        await this.logger.info(
          "No table data found, attempting modern structure extraction",
        );
        const modernLunches = await this.extractFromModernStructure(container);
        lunches.push(...modernLunches);
        await this.logger.info("Modern structure extraction completed", {
          itemCount: modernLunches.length,
        });
      }

      // Check if restaurant is closed
      if (lunches.length === 0) {
        const isClosedInfo = this.checkIfRestaurantClosed(container);
        if (isClosedInfo.isClosed) {
          await this.logger.info("Restaurant is closed", {
            reason: isClosedInfo.reason,
            closureIndicators: isClosedInfo.indicators,
          });
        }
      }

      return lunches;
    } catch (error) {
      await this.logger.error("Error extracting lunch data", {}, error);
      return [];
    }
  }

  /**
   * Extract lunch data from table structure
   */
  async extractFromTableStructure(container) {
    const lunches = [];
    const tables = this.safeQuery(
      container,
      this.selectors.tableSelectors.table,
      true,
    );

    if (!tables || tables.length === 0) {
      await this.logger.debug("No tables found in container");
      return lunches;
    }

    await this.logger.info(`Found ${tables.length} tables in container`);

    const weekdays = SWEDISH_WEEKDAYS;
    const currentWeek = this.extractWeekNumber(container);

    for (const [weekdayIndex, weekday] of weekdays.entries()) {
      const tableIndex = Math.floor(weekdayIndex / 1); // Each table might have multiple days
      const table = tables[tableIndex];

      if (!table) {
        await this.logger.debug(
          `No table found for ${weekday} at index ${tableIndex}`,
        );
        continue;
      }

      const rows = this.safeQuery(
        table,
        this.selectors.tableSelectors.rows,
        true,
      );
      if (!rows) {
        await this.logger.debug(`No rows found in table for ${weekday}`);
        continue;
      }

      await this.logger.debug(`Found table rows for weekday`, {
        weekday,
        rowCount: rows.length,
      });

      for (const row of rows) {
        const lunch = await this.extractLunchFromTableRow(
          row,
          currentWeek,
          weekday,
        );
        if (lunch) {
          lunches.push(lunch);
          await this.logger.debug(
            `Added valid lunch item for ${weekday}: "${lunch.name}" - ${lunch.price}kr`,
          );
        }
      }
    }

    return lunches;
  }

  /**
   * Extract lunch from a table row
   */
  async extractLunchFromTableRow(row, week, weekday) {
    try {
      const cells = this.safeQuery(
        row,
        this.selectors.tableSelectors.cells,
        true,
      );
      if (!cells || cells.length < 3) {
        await this.logger.debug("Table row missing required cells", {
          cellsFound: cells ? cells.length : 0,
          cellsRequired: 3,
        });
        return null;
      }

      const name = this.extractText(cells[0]).trim();
      const description = this.extractText(cells[1]).trim();
      const priceText = this.extractText(cells[2]).trim();

      if (!name || name.length === 0) {
        await this.logger.debug("Skipping row with empty name");
        return null;
      }

      const price = this.extractNumber(priceText);
      if (price <= 0) {
        await this.logger.debug("Skipping row with invalid price", {
          priceText,
          extractedPrice: price,
        });
        return null;
      }

      return this.createLunchObject({
        name,
        description,
        price,
        weekday,
        week,
        place: this.getName(),
      });
    } catch (error) {
      await this.logger.warn(
        "Failed to extract lunch from table row",
        {},
        error,
      );
      return null;
    }
  }

  /**
   * Extract lunch data from modern structure (tabs, cards, etc.)
   */
  async extractFromModernStructure(container) {
    const lunches = [];
    const weekdays = SWEDISH_WEEKDAYS;
    const currentWeek = this.extractWeekNumber(container);

    for (const weekday of weekdays) {
      const elements = await this.findWeekdayContent(container, weekday);

      await this.logger.debug(
        `Found ${elements.length} elements for ${weekday} in modern structure`,
      );

      for (const element of elements) {
        const lunch = await this.extractLunchFromModernElement(
          element,
          currentWeek,
          weekday,
        );
        if (lunch) {
          lunches.push(lunch);
          await this.logger.debug(
            `Added valid lunch item for ${weekday}: "${lunch.name}" - ${lunch.price}kr`,
          );
        }
      }
    }

    return lunches;
  }

  /**
   * Find content for a specific weekday using various methods
   */
  async findWeekdayContent(container, weekday) {
    const elements = [];

    try {
      // Method 1: Look for weekday heading and following content
      const headings = this.safeQuery(
        container,
        this.selectors.modernSelectors.weekdayHeaders.join(", "),
        true,
      );

      if (headings) {
        for (const heading of headings) {
          const headingText = this.extractText(heading).toLowerCase();
          if (headingText.includes(weekday)) {
            await this.logger.debug(
              `Found matching heading for ${weekday}: "${this.extractText(heading)}"`,
            );

            // Get following elements
            let nextElement = heading.nextElementSibling;
            while (nextElement && elements.length < 10) {
              if (this.isLunchElement(nextElement)) {
                elements.push(nextElement);
              }
              nextElement = nextElement.nextElementSibling;
            }
          }
        }
      }

      // Method 2: Look for tab panels with data attributes
      const tabPanels = this.safeQuery(
        container,
        this.selectors.modernSelectors.tabPanels.join(", "),
        true,
      );

      if (tabPanels) {
        await this.logger.debug(
          `Found ${tabPanels.length} tab panels to check for ${weekday}`,
        );

        for (const panel of tabPanels) {
          const dataDay = panel.getAttribute && panel.getAttribute("data-day");
          const dataWeekday =
            panel.getAttribute && panel.getAttribute("data-weekday");
          const ariaLabel = panel.getAttribute && panel.getAttribute("aria-label");
          const labelledBy =
            panel.getAttribute && panel.getAttribute("aria-labelledby");
          const labelledByText = labelledBy
            ? this.extractText(
                this.safeQuery(container, `#${labelledBy}`) || panel,
              ).toLowerCase()
            : "";
          const panelText = this.extractText(panel).toLowerCase();

          const headingMatch =
            ariaLabel?.toLowerCase().includes(weekday) ||
            labelledByText.includes(weekday) ||
            panelText.includes(weekday);

          if (
            dataDay === weekday ||
            dataWeekday === weekday ||
            headingMatch
          ) {
            await this.logger.debug(`Found matching tab panel for ${weekday}`, {
              "data-day": !!dataDay,
              "data-weekday": !!dataWeekday,
              text: headingMatch,
              labelledBy,
            });

            const items = this.safeQuery(
              panel,
              this.selectors.modernSelectors.lunchItems.join(", "),
              true,
            );
            if (items) {
              elements.push(...items);
              await this.logger.debug(
                `Found ${items.length} items in tab panel for ${weekday}`,
              );
            } else if (panelText.trim().length > 0) {
              elements.push(panel);
            }
          }
        }
      }

      // Method 3: Look for day-specific sections
      for (const selectorTemplate of this.selectors.modernSelectors
        .daySections) {
        const selector = selectorTemplate.replace(/\{\{weekday\}\}/g, weekday);
        const daySection = this.safeQuery(container, selector);

        if (daySection) {
          await this.logger.debug(
            `Found day section for ${weekday} with selector: ${selector}`,
          );
          const items = this.safeQuery(
            daySection,
            this.selectors.modernSelectors.lunchItems.join(", "),
            true,
          );
          if (items) {
            elements.push(...items);
          }
        }
      }
    } catch (error) {
      await this.logger.warn(
        `Error finding weekday content for ${weekday}`,
        {},
        error,
      );
    }

    return elements;
  }

  /**
   * Check if an element looks like a lunch item
   */
  isLunchElement(element) {
    if (!element || !element.tagName) return false;

    const className = element.className || "";
    const hasLunchClass =
      className.includes("lunch") ||
      className.includes("item") ||
      className.includes("dish") ||
      className.includes("meal");

    const hasLunchContent = this.extractText(element).length > 5;

    return hasLunchClass || hasLunchContent;
  }

  /**
   * Extract lunch from modern element (card, item, etc.)
   */
  async extractLunchFromModernElement(element, week, weekday) {
    try {
      // Try multiple selectors for name
      const nameSelectors = [
        ".lunch-name",
        ".name",
        ".title",
        "h4",
        "h5",
        ".meal-title",
        "strong",
        "b",
      ];
      let name = "";

      for (const selector of nameSelectors) {
        const nameElement = this.safeQuery(element, selector);
        if (nameElement) {
          name = this.extractText(nameElement).trim();
          if (name.length > 0) break;
        }
      }

      // If no name found with selectors, try direct text content
      if (!name) {
        const directText = this.extractText(element);
        const lines = directText
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0);
        if (lines.length > 0) {
          name = lines[0]; // First line is likely the name
        }
      }

      if (!name || name.length === 0) {
        await this.logger.debug("No name found in modern element", {
          elementTag: element.tagName,
          elementClass: element.className,
        });
        return null;
      }

      // Try multiple selectors for description
      const descSelectors = [
        ".description",
        ".desc",
        "p",
        ".details",
        ".ingredients",
      ];
      let description = "";

      for (const selector of descSelectors) {
        const descElement = this.safeQuery(element, selector);
        if (descElement) {
          description = this.extractText(descElement).trim();
          if (description.length > 0) break;
        }
      }

      // Try multiple selectors for price
      const priceSelectors = [".price", ".cost", ".amount", "span", ".kr"];
      let price = 0;

      for (const selector of priceSelectors) {
        const priceElement = this.safeQuery(element, selector);
        if (priceElement) {
          const priceText = this.extractText(priceElement);
          const extractedPrice = this.extractNumber(priceText);
          if (extractedPrice > 0) {
            price = extractedPrice;
            break;
          }
        }
      }

      // If no price found with selectors, try extracting from full text
      if (price <= 0) {
        const fullText = this.extractText(element);
        price = this.extractNumber(fullText);
      }

      if (price <= 0) {
        await this.logger.debug("No valid price found in modern element", {
          elementText: this.extractText(element).substring(0, 100),
        });
        return null;
      }

      return this.createLunchObject({
        name,
        description,
        price,
        weekday,
        week,
        place: this.getName(),
      });
    } catch (error) {
      await this.logger.warn(
        "Failed to extract lunch from modern element",
        {},
        error,
      );
      return null;
    }
  }

  /**
   * Extract week number from container
   */
  extractWeekNumber(container) {
    try {
      const textCandidates = [this.extractText(container)];

      for (const selector of this.selectors.weekSelectors) {
        const weekElement = this.safeQuery(container, selector);
        if (weekElement) {
          textCandidates.push(this.extractText(weekElement));
        }
      }

      for (const weekText of textCandidates.filter(Boolean)) {
        const normalizedText = weekText.replace(/\s+/g, " ").trim();

        // Format 1: "Vecka 47"
        let match = normalizedText.match(/vecka[\s\u00a0]*(\d{1,2})\b/i);
        if (match) {
          const week = parseInt(match[1]);
          if (week >= 1 && week <= 53) {
            this.logger.debug(
              `Found week number: ${week} from text: "${weekText}"`,
            );
            return week;
          }
        }

        // Format 2: "Vecka 20250714" (date format without separators)
        const eightDigitSequence = normalizedText.replace(/\D/g, "");
        match =
          normalizedText.match(/vecka[\s\u00a0]*(\d{8})/i) ||
          (eightDigitSequence.length === 8 ? [null, eightDigitSequence] : null);
        if (match) {
          const dateStr = match[1];
          const year = parseInt(dateStr.substring(0, 4));
          const month = parseInt(dateStr.substring(4, 6));
          const day = parseInt(dateStr.substring(6, 8));

          try {
            const date = new Date(year, month - 1, day);
            const week = this.getWeekNumber(date);
            this.logger.debug(
              `Calculated week number: ${week} from date: ${dateStr}`,
            );
            return week;
          } catch (dateError) {
            this.logger.warn("Failed to parse date from week text", {
              dateStr,
            });
          }
        }

        // Format 3: "Vecka 2025-07-14" (date with separators)
        match = weekText.match(/vecka\s*(\d{4})[-/.](\d{2})[-/.](\d{2})/i);
        if (match) {
          const [, year, month, day] = match.map((v) => parseInt(v));
          try {
            const date = new Date(year, month - 1, day);
            const week = this.getWeekNumber(date);
            this.logger.debug(
              `Calculated week number: ${week} from formatted date: ${weekText}`,
            );
            return week;
          } catch (dateError) {
            this.logger.warn("Failed to parse formatted date from week text", {
              weekText,
            });
          }
        }
      }

      // Fallback to current week
      const currentWeek = this._getCurrentWeek();
      this.logger.debug(`Using current week as fallback: ${currentWeek}`);
      return currentWeek;
    } catch (error) {
      this.logger.warn("Error extracting week number", {}, error);
      return this._getCurrentWeek();
    }
  }

  /**
   * Get ISO week number from date
   */
  getWeekNumber(date) {
    const d = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
    );
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  }

  /**
   * Check if restaurant is closed based on content
   */
  checkIfRestaurantClosed(container) {
    const text = this.extractText(container).toLowerCase();

    const closureKeywords = [
      "semesterstängt",
      "semester",
      "stängt",
      "closed",
      "vacation",
      "uppehåll",
      "paus",
      "tillfälligt stängt",
      "sommarstängt",
    ];

    const foundKeywords = [];
    for (const keyword of closureKeywords) {
      if (text.includes(keyword)) {
        foundKeywords.push(keyword);
      }
    }

    // Check for vacation week patterns (V.XX-XX or similar)
    const vacationPattern = /v\.?\s*\d+\s*[-–]\s*\d+/i;
    const hasVacationPattern = vacationPattern.test(text);
    if (hasVacationPattern) {
      foundKeywords.push("vacation week pattern detected");
    }

    const isClosed = foundKeywords.length > 0;
    const reason = isClosed
      ? `Restaurant appears closed: ${foundKeywords.join(", ")}`
      : "Restaurant appears to be open";

    return {
      isClosed,
      reason,
      indicators: foundKeywords,
    };
  }
}

export default NiagaraParser;
