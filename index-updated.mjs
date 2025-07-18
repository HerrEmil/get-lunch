import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { JSDOM } from "jsdom";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const handler = async (event, context, callback) => {
  const lunch = {
    description: "",
    name: "",
    place: "",
    price: 0,
    week: 0,
    weekday: "",
  };

  /** @type {lunch[]} */
  const lunches = [];

  // logic here

  /** @param {string} html */
  function htmlToElement(html) {
    const document = new JSDOM(html).window.document;
    return document.body.firstElementChild;
  }

  /**
   * @param {string} url
   * @param {string} selector
   * @return {Promise<Element>}
   */
  function getHtmlNodeFromUrl(url, selector) {
    return fetch(url).then(async (response) => {
      const html = await response.text();
      return htmlToElement(`<div>${html}</div>`).querySelector(selector);
    });
  }

  /**
   * Updated function to handle lunch data extraction with improved selectors
   * @param {Element} element - Can be a table row or other container element
   * @param {number} week
   * @param {string} weekday
   */
  function addNiagaraRowToLunches(element, week, weekday) {
    try {
      let name, description, price;

      // Try table-based extraction (original format)
      if (element.tagName === "TR") {
        name = element.querySelector("td:nth-of-type(1)")?.textContent?.trim();
        description = element
          .querySelector("td:nth-of-type(2)")
          ?.textContent?.split("\n")[0]
          ?.trim();
        const priceText =
          element.querySelector("td:nth-of-type(3)")?.textContent;
        price = priceText ? Number(priceText.split(":-")[0]) : 0;
      } else {
        // Try modern div/card-based extraction (new format)
        name =
          element
            .querySelector(".lunch-name, .name, .title")
            ?.textContent?.trim() ||
          element.querySelector("h4, h5, .meal-title")?.textContent?.trim();
        description = element
          .querySelector(".lunch-description, .description, .details")
          ?.textContent?.trim();
        const priceText = element.querySelector(
          ".lunch-price, .price, .cost",
        )?.textContent;
        price = priceText ? Number(priceText.replace(/[^0-9]/g, "")) : 0;
      }

      // Only add if we have valid data
      if (name && name.length > 0) {
        lunches.push({
          description: description || "",
          name: name,
          price: price || 0,
          place: "Niagara",
          week,
          weekday,
        });
      }
    } catch (error) {
      console.error(`Error extracting lunch data for ${weekday}:`, error);
    }
  }

  /**
   * Updated week extraction to handle new format "Vecka 20250714"
   * @param {Element} container
   * @returns {number}
   */
  function extractWeekNumber(container) {
    try {
      // Try new format first: "Vecka 20250714"
      const weekElement = container.querySelector("h3, h2, .week-header");
      if (weekElement) {
        const weekText = weekElement.textContent;

        // New format: "Vecka 20250714" - extract week from date
        const newFormatMatch = weekText.match(/Vecka (\d{8})/);
        if (newFormatMatch) {
          const dateStr = newFormatMatch[1];
          const year = parseInt(dateStr.substring(0, 4));
          const month = parseInt(dateStr.substring(4, 6)) - 1; // Month is 0-based
          const day = parseInt(dateStr.substring(6, 8));
          const date = new Date(year, month, day);

          // Calculate week number
          const startDate = new Date(date.getFullYear(), 0, 1);
          const days = Math.floor((date - startDate) / (24 * 60 * 60 * 1000));
          return Math.ceil((days + startDate.getDay() + 1) / 7);
        }

        // Old format: "Vecka XX"
        const oldFormatMatch = weekText.match(/Vecka (\d{1,2})/);
        if (oldFormatMatch) {
          return parseInt(oldFormatMatch[1]);
        }
      }

      // Fallback to current week
      const now = new Date();
      const startDate = new Date(now.getFullYear(), 0, 1);
      const days = Math.floor((now - startDate) / (24 * 60 * 60 * 1000));
      return Math.ceil((days + startDate.getDay() + 1) / 7);
    } catch (error) {
      console.error("Error extracting week number:", error);
      // Fallback to week 1
      return 1;
    }
  }

  try {
    // Try multiple container selectors for compatibility
    const containerSelectors = [
      "div.lunch", // Original selector
      "section", // Modern semantic selector
      ".lunch-menu", // Semantic class
      "main", // Main content area
      "body", // Fallback to body
    ];

    let lunchNode = null;
    for (const selector of containerSelectors) {
      try {
        lunchNode = await getHtmlNodeFromUrl(
          "https://restaurangniagara.se/lunch/",
          selector,
        );
        if (lunchNode) break;
      } catch (error) {
        console.warn(`Selector ${selector} failed:`, error);
      }
    }

    if (!lunchNode) {
      console.error("Could not find lunch container with any selector");
      throw new Error("Lunch container not found");
    }

    const week = extractWeekNumber(lunchNode);
    const weekdays = ["måndag", "tisdag", "onsdag", "torsdag", "fredag"];

    // Try table-based extraction (original approach)
    let dataFound = false;
    for (const [index, weekday] of weekdays.entries()) {
      const rows = lunchNode.querySelectorAll(
        `table:nth-of-type(${index + 1}) tbody tr`,
      );
      if (rows.length > 0) {
        dataFound = true;
        [...rows].forEach((row) => {
          addNiagaraRowToLunches(row, week, weekday);
        });
      }
    }

    // If no table data found, try modern structure (tab-based)
    if (!dataFound) {
      for (const weekday of weekdays) {
        // Try to find weekday content by heading
        const dayHeadings = lunchNode.querySelectorAll("h3, h4, .day-header");
        for (const heading of dayHeadings) {
          if (heading.textContent.toLowerCase().includes(weekday)) {
            // Look for lunch items after this heading
            let nextElement = heading.nextElementSibling;
            while (nextElement) {
              // Try different patterns for lunch data
              const lunchItems = nextElement.querySelectorAll(
                ".lunch-item, .menu-item, .meal, tr, .food-item",
              );

              if (lunchItems.length > 0) {
                [...lunchItems].forEach((item) => {
                  addNiagaraRowToLunches(item, week, weekday);
                });
                break;
              }
              nextElement = nextElement.nextElementSibling;
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("Error fetching Niagara lunch data:", error);
    // Continue with empty lunches array - graceful degradation
  }

  const body = fs
    .readFileSync(path.resolve(__dirname, "./index.html"), {
      encoding: "utf-8",
    })
    .replace(
      "const lunches = [];",
      `const lunches = ${JSON.stringify(lunches)};`,
    );

  return {
    statusCode: 200,
    body,
  };
};
