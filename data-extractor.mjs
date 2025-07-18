import { extractWeekNumber } from "./week-extractor.mjs";
import {
  SWEDISH_WEEKDAYS,
  isValidSwedishWeekday,
  normalizeSwedishWeekday,
} from "./weekday-mapper.mjs";
import {
  validateLunches,
  validateRestaurantStatus,
  logValidationResults,
} from "./data-validator.mjs";

/**
 * Updated data extraction logic for Niagara restaurant
 * Handles both old table-based structure and new tabbed interface
 */

/**
 * Extract lunch data from element with improved selectors for new structure
 * @param {Element} element - Can be a table row or other container element
 * @param {number} week
 * @param {string} weekday
 * @returns {object|null} - Lunch object or null if invalid
 */
export function extractLunchFromElement(element, week, weekday) {
  try {
    if (!element) {
      console.warn("No element provided to extractLunchFromElement");
      return null;
    }

    // Check if element has expected properties
    if (!element.tagName) {
      console.warn(
        "Element missing tagName property - may not be a DOM element",
      );
      console.warn(
        `Element type: ${typeof element}, constructor: ${element?.constructor?.name}`,
      );
      return null;
    }

    // Check if element has any content
    if (!element.textContent || element.textContent.trim().length === 0) {
      console.warn(
        `Element for ${weekday} has no text content (tagName: ${element.tagName})`,
      );

      // Check if element has child elements but no text
      if (element.children && element.children.length > 0) {
        console.warn(
          `Element has ${element.children.length} child elements but no text content`,
        );
      } else {
        console.warn("Element has no child elements and no text content");
      }
      return null;
    }

    let name, description, price;

    // Try table-based extraction (original format)
    if (element.tagName === "TR") {
      // Check if table row has required cells
      const cells = element.querySelectorAll("td");
      if (cells.length < 3) {
        console.warn(
          `Table row for ${weekday} missing required cells (has ${cells.length}, needs 3)`,
        );

        // Enhanced debugging for table structure
        if (cells.length === 0) {
          console.warn(`Table row has no <td> elements at all`);
          // Check for other cell types
          const thCells = element.querySelectorAll("th");
          if (thCells.length > 0) {
            console.warn(
              `Table row has ${thCells.length} <th> elements instead of <td>`,
            );
          }
        } else {
          console.warn(
            `Table row cell contents: ${Array.from(cells)
              .map((cell) => cell.textContent?.trim())
              .join(" | ")}`,
          );
        }
        return null;
      }

      const nameCell = element.querySelector("td:nth-of-type(1)");
      const descCell = element.querySelector("td:nth-of-type(2)");
      const priceCell = element.querySelector("td:nth-of-type(3)");

      if (!nameCell || !descCell || !priceCell) {
        console.warn(
          `Table row for ${weekday} missing expected cell structure`,
        );

        // Enhanced debugging for missing cells
        console.warn(
          `Cell availability: name=${!!nameCell}, desc=${!!descCell}, price=${!!priceCell}`,
        );

        if (!nameCell) console.warn("Name cell (td:nth-of-type(1)) not found");
        if (!descCell)
          console.warn("Description cell (td:nth-of-type(2)) not found");
        if (!priceCell)
          console.warn("Price cell (td:nth-of-type(3)) not found");

        return null;
      }

      name = nameCell.textContent?.trim();
      description = descCell.textContent?.split("\n")[0]?.trim();
      const priceText = priceCell.textContent?.trim();
      if (priceText) {
        const priceMatch = priceText.match(/(\d+)\s*(?::-|kr|kronor)?/i);
        price = priceMatch ? Number(priceMatch[1]) : null;
      } else {
        price = null;
      }
    } else {
      // Try modern div/card-based extraction (new format)

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
      let nameElement = null;

      for (const selector of nameSelectors) {
        nameElement = element.querySelector(selector);
        if (nameElement && nameElement.textContent?.trim()) {
          break;
        }
      }

      if (!nameElement) {
        console.warn(`No name element found for ${weekday} using any selector`);
        console.warn(`Tried selectors: ${nameSelectors.join(", ")}`);

        // Enhanced debugging for missing name element
        const elementHTML = element.outerHTML?.substring(0, 200) || "N/A";
        console.warn(`Element structure: ${elementHTML}...`);

        // Check what child elements exist
        if (element.children && element.children.length > 0) {
          const childTags = Array.from(element.children).map((child) =>
            child.tagName.toLowerCase(),
          );
          console.warn(`Child element tags: ${childTags.join(", ")}`);
        }

        // Try to extract text directly from element as last resort
        const directText = element.textContent?.trim();
        if (directText && directText.length > 0) {
          console.warn(
            `Element has direct text content: "${directText.substring(0, 50)}..."`,
          );
          console.warn("Consider using direct text extraction as fallback");
        }

        return null;
      }

      name = nameElement.textContent?.trim();

      // Try multiple selectors for description
      const descSelectors = [
        ".lunch-description",
        ".description",
        ".details",
        "p",
      ];
      let descElement = null;

      for (const selector of descSelectors) {
        descElement = element.querySelector(selector);
        if (descElement && descElement.textContent?.trim()) {
          break;
        }
      }

      description = descElement?.textContent?.trim() || "";

      // Improved price extraction with fallback strategies
      const priceSelectors = [".lunch-price", ".price", ".cost"];
      let priceElement = null;

      for (const selector of priceSelectors) {
        priceElement = element.querySelector(selector);
        if (priceElement && priceElement.textContent?.trim()) {
          break;
        }
      }

      let priceText = priceElement?.textContent;

      // If no specific price element found, search in full text
      if (!priceText) {
        priceText = element.textContent;
      }

      const priceMatch = priceText?.match(/(\d+)\s*(?:kr|:-|kronor)/i);
      price = priceMatch ? Number(priceMatch[1]) : null;
    }

    // Only return if we have valid data, valid price, and valid Swedish weekday
    if (
      name &&
      name.length > 0 &&
      price !== null &&
      price >= 0 &&
      isValidSwedishWeekday(weekday)
    ) {
      return {
        description: description || "",
        name: name,
        price: price,
        place: "Niagara",
        week,
        weekday: normalizeSwedishWeekday(weekday),
      };
    }
    return null;
  } catch (error) {
    console.error(`Error extracting lunch data for ${weekday}:`, error);
    return null;
  }
}

/**
 * Updated function to find weekday content in new tabbed structure
 * @param {Element} container - Main container element
 * @param {string} weekday - Swedish weekday name
 * @returns {Array<Element>} - Array of elements containing lunch data
 */
export function findWeekdayContent(container, weekday) {
  const dataElements = [];

  try {
    if (!container || !weekday) {
      console.warn(
        "Invalid container or weekday provided to findWeekdayContent",
      );
      return dataElements;
    }

    // Check if container has any content at all
    if (!container.textContent || container.textContent.trim().length === 0) {
      console.warn(
        `Container is empty or has no text content for weekday: ${weekday}`,
      );
      return dataElements;
    }

    // Check if container has any child elements
    if (!container.children || container.children.length === 0) {
      console.warn(`Container has no child elements for weekday: ${weekday}`);
      return dataElements;
    }

    // Method 1: Look for weekday heading and following content
    try {
      const headings = container.querySelectorAll(
        "h3, h4, .day-header, .tab-header",
      );

      if (headings.length === 0) {
        console.warn(`No headings found in container for weekday: ${weekday}`);
        console.warn("Attempted selectors: h3, h4, .day-header, .tab-header");

        // Check what headings actually exist
        const allHeadings = container.querySelectorAll(
          "h1, h2, h3, h4, h5, h6",
        );
        if (allHeadings.length > 0) {
          const headingInfo = Array.from(allHeadings)
            .map((h) => `${h.tagName}:"${h.textContent?.trim() || "empty"}"`)
            .join(", ");
          console.warn(`Found other headings: ${headingInfo}`);
        } else {
          console.warn("No headings of any type found in container");
        }
      }

      for (const heading of headings) {
        try {
          if (!heading.textContent || heading.textContent.trim().length === 0) {
            console.warn(
              `Heading element exists but has no text content for weekday: ${weekday}`,
            );
            continue;
          }

          const normalizedWeekday = normalizeSwedishWeekday(weekday);
          if (!normalizedWeekday) {
            console.warn(`Could not normalize weekday: ${weekday}`);
            continue;
          }

          if (heading.textContent.toLowerCase().includes(normalizedWeekday)) {
            console.info(
              `Found matching heading for ${weekday}: "${heading.textContent.trim()}"`,
            );

            // Look for content after this heading
            let nextElement = heading.nextElementSibling;
            let searchCount = 0;
            const maxSearch = 10; // Prevent infinite loops

            if (!nextElement) {
              console.warn(
                `Heading for ${weekday} has no next sibling elements`,
              );
              continue;
            }

            while (nextElement && searchCount < maxSearch) {
              searchCount++;
              try {
                // Validate element before processing
                if (!nextElement.tagName) {
                  console.warn(
                    `Invalid next element for ${weekday} - missing tagName`,
                  );
                  nextElement = nextElement.nextElementSibling;
                  continue;
                }

                // Try different patterns for lunch data
                const items = nextElement.querySelectorAll(
                  ".lunch-item, .menu-item, .meal, tr, .food-item, .dish, li",
                );

                if (items.length > 0) {
                  console.info(
                    `Found ${items.length} lunch items after heading for ${weekday}`,
                  );
                  dataElements.push(...items);
                  break;
                }

                // If this element itself might contain lunch data
                if (
                  nextElement.textContent &&
                  nextElement.textContent.trim().length > 10
                ) {
                  console.info(
                    `Using direct element content for ${weekday} (${nextElement.tagName})`,
                  );
                  dataElements.push(nextElement);
                  break;
                }

                nextElement = nextElement.nextElementSibling;
              } catch (elemError) {
                console.warn(
                  `Error processing element ${searchCount} in weekday content search for ${weekday}:`,
                  elemError,
                );
                nextElement = nextElement.nextElementSibling;
              }
            }

            if (searchCount >= maxSearch) {
              console.warn(
                `Reached maximum search depth (${maxSearch}) for ${weekday} without finding content`,
              );
            }
          }
        } catch (headingError) {
          console.warn(
            `Error processing heading in weekday content search for ${weekday}:`,
            headingError,
          );
        }
      }
    } catch (headingsError) {
      console.warn(
        `Error querying headings for weekday ${weekday}:`,
        headingsError,
      );
    }

    // Method 2: Look for tab content with data attributes
    try {
      const tabPanels = container.querySelectorAll(
        "[data-day], [data-weekday], .tab-content",
      );

      if (tabPanels.length === 0) {
        console.warn(
          `No tab panels found in container for weekday: ${weekday}`,
        );
        console.warn(
          "Attempted selectors: [data-day], [data-weekday], .tab-content",
        );

        // Check for any elements with data attributes
        const dataElements = container.querySelectorAll(
          "[data-day], [data-weekday], [data-meal], [data-type]",
        );
        if (dataElements.length > 0) {
          const dataAttrs = Array.from(dataElements)
            .map((el) =>
              Object.keys(el.dataset)
                .map((key) => `data-${key}="${el.dataset[key]}"`)
                .join(" "),
            )
            .filter(Boolean)
            .slice(0, 5);
          console.warn(`Found other data attributes: ${dataAttrs.join(", ")}`);
        }
      } else {
        console.info(
          `Found ${tabPanels.length} tab panels to check for ${weekday}`,
        );
      }

      for (const panel of tabPanels) {
        try {
          if (!panel.dataset) {
            console.warn(
              `Tab panel missing dataset property for weekday: ${weekday}`,
            );
            continue;
          }

          const dataAttrs = panel.dataset;
          const normalizedWeekday = normalizeSwedishWeekday(weekday);

          if (!normalizedWeekday) {
            console.warn(
              `Could not normalize weekday for tab panel check: ${weekday}`,
            );
            continue;
          }

          const matchesDataDay = dataAttrs.day === normalizedWeekday;
          const matchesDataWeekday = dataAttrs.weekday === normalizedWeekday;
          const matchesTextContent =
            panel.textContent &&
            panel.textContent.toLowerCase().includes(normalizedWeekday);

          if (matchesDataDay || matchesDataWeekday || matchesTextContent) {
            console.info(
              `Found matching tab panel for ${weekday} (data-day: ${matchesDataDay}, data-weekday: ${matchesDataWeekday}, text: ${matchesTextContent})`,
            );

            if (!panel.textContent || panel.textContent.trim().length === 0) {
              console.warn(`Tab panel for ${weekday} has no text content`);
              continue;
            }

            const items = panel.querySelectorAll(
              ".lunch-item, .menu-item, .meal, tr, .food-item, .dish, li, p",
            );

            if (items.length === 0) {
              console.warn(
                `Tab panel for ${weekday} found but contains no lunch items`,
              );
              console.warn(
                "Attempted selectors: .lunch-item, .menu-item, .meal, tr, .food-item, .dish, li, p",
              );

              // Check what child elements actually exist
              if (panel.children.length > 0) {
                const childTags = Array.from(panel.children).map((child) =>
                  child.tagName.toLowerCase(),
                );
                const uniqueTags = [...new Set(childTags)];
                console.warn(`Tab panel children: ${uniqueTags.join(", ")}`);
              }
            } else {
              console.info(
                `Found ${items.length} items in tab panel for ${weekday}`,
              );
              dataElements.push(...items);
            }
          }
        } catch (panelError) {
          console.warn(
            `Error processing tab panel in weekday content search for ${weekday}:`,
            panelError,
          );
        }
      }
    } catch (tabError) {
      console.warn(
        `Error querying tab panels for weekday ${weekday}:`,
        tabError,
      );
    }

    // Method 3: Look for sections with weekday class names
    const daySelectors = [
      `.${weekday}`,
      `.day-${weekday}`,
      `[class*="${weekday}"]`,
      `#${weekday}`,
      `#day-${weekday}`,
    ];

    let foundDaySection = false;
    for (const selector of daySelectors) {
      try {
        const daySection = container.querySelector(selector);
        if (daySection) {
          foundDaySection = true;
          console.info(
            `Found day section for ${weekday} using selector: ${selector}`,
          );

          try {
            if (
              !daySection.textContent ||
              daySection.textContent.trim().length === 0
            ) {
              console.warn(`Day section for ${weekday} has no text content`);
              continue;
            }

            const items = daySection.querySelectorAll(
              ".lunch-item, .menu-item, .meal, tr, .food-item, .dish, li, p",
            );

            if (items.length === 0) {
              console.warn(
                `Day section for ${weekday} found but contains no lunch items`,
              );
              console.warn(
                "Attempted selectors: .lunch-item, .menu-item, .meal, tr, .food-item, .dish, li, p",
              );

              // Check what child elements actually exist in the day section
              if (daySection.children.length > 0) {
                const childTags = Array.from(daySection.children).map((child) =>
                  child.tagName.toLowerCase(),
                );
                const uniqueTags = [...new Set(childTags)];
                console.warn(`Day section children: ${uniqueTags.join(", ")}`);
              } else {
                console.warn(
                  `Day section for ${weekday} has no child elements`,
                );
              }
            } else {
              console.info(
                `Found ${items.length} items in day section for ${weekday}`,
              );
              dataElements.push(...items);
            }
          } catch (itemsError) {
            console.warn(
              `Error querying items in day section for ${weekday}:`,
              itemsError,
            );
          }
        }
      } catch (selectorError) {
        console.warn(
          `Error with day selector ${selector} for ${weekday}:`,
          selectorError,
        );
      }
    }

    if (!foundDaySection) {
      console.warn(`No day sections found for ${weekday} using any selector`);
      console.warn(`Attempted selectors: ${daySelectors.join(", ")}`);

      // Check what class names and IDs actually exist in the container
      const elementsWithClasses = container.querySelectorAll("[class]");
      const elementsWithIds = container.querySelectorAll("[id]");

      if (elementsWithClasses.length > 0) {
        const classNames = Array.from(elementsWithClasses)
          .map((el) => el.className)
          .filter(Boolean)
          .slice(0, 10);
        console.warn(`Available class names: ${classNames.join(", ")}`);
      }

      if (elementsWithIds.length > 0) {
        const idNames = Array.from(elementsWithIds)
          .map((el) => el.id)
          .filter(Boolean)
          .slice(0, 10);
        console.warn(`Available IDs: ${idNames.join(", ")}`);
      }
    }
  } catch (error) {
    console.error(`Error finding weekday content for ${weekday}:`, error);
  }

  return dataElements;
}

/**
 * Extract all lunch data for all weekdays from container
 * @param {Element} container - Main container element
 * @returns {Array<object>} - Array of lunch objects
 */
export function extractAllLunchData(container) {
  const lunches = [];

  try {
    if (!container) {
      console.error("No container provided to extractAllLunchData");
      return lunches;
    }

    // Check if container has any content
    if (!container.textContent || container.textContent.trim().length === 0) {
      console.warn("Container is completely empty - no lunch data to extract");
      return lunches;
    }

    // Check restaurant status for closure indicators
    const restaurantStatus = validateRestaurantStatus(container);
    if (!restaurantStatus.isOpen) {
      console.warn("Restaurant appears to be closed:", restaurantStatus.reason);
      console.warn("Closure indicators:", restaurantStatus.closureIndicators);
      return lunches; // Return empty array for closed restaurant
    }

    // Check if container has child elements
    if (!container.children || container.children.length === 0) {
      console.warn("Container has no child elements - likely malformed HTML");
      return lunches;
    }

    let week;
    try {
      week = extractWeekNumber(container);
    } catch (weekError) {
      console.warn("Error extracting week number, using fallback:", weekError);
      // Fallback to current week
      const now = new Date();
      const startDate = new Date(now.getFullYear(), 0, 1);
      const days = Math.floor((now - startDate) / (24 * 60 * 60 * 1000));
      week = Math.ceil((days + startDate.getDay() + 1) / 7);
    }

    const weekdays = SWEDISH_WEEKDAYS;

    // Try table-based extraction first (original approach)
    let dataFound = false;

    // Check if any tables exist in the container
    const allTables = container.querySelectorAll("table");
    if (allTables.length === 0) {
      console.info(
        "No tables found in container - will try modern structure extraction",
      );
    } else {
      console.info(`Found ${allTables.length} tables in container`);

      try {
        for (const [index, weekday] of weekdays.entries()) {
          try {
            const tableSelector = `table:nth-of-type(${index + 1})`;
            const targetTable = container.querySelector(tableSelector);

            if (!targetTable) {
              console.warn(
                `No table found for ${weekday} at index ${index + 1}`,
              );
              // Check if there are any tables at all in container
              const allTablesCount = container.querySelectorAll("table").length;
              if (allTablesCount === 0) {
                console.warn(`Container has no tables at all for ${weekday}`);
              } else {
                console.warn(
                  `Container has ${allTablesCount} tables but none at index ${index + 1} for ${weekday}`,
                );
              }
              continue;
            }

            // Validate table structure
            if (
              !targetTable.tagName ||
              targetTable.tagName.toLowerCase() !== "table"
            ) {
              console.warn(
                `Found element for ${weekday} but it's not a table (${targetTable.tagName})`,
              );
              continue;
            }

            const tbody = targetTable.querySelector("tbody");
            if (!tbody) {
              console.warn(`Table for ${weekday} missing tbody element`);
              // Try to find rows directly in table as fallback
              const directRows = targetTable.querySelectorAll("tr");
              if (directRows.length === 0) {
                console.warn(
                  `Table for ${weekday} has no rows even without tbody`,
                );
                continue;
              } else {
                console.warn(
                  `Table for ${weekday} has ${directRows.length} direct rows without tbody`,
                );
              }
              continue;
            }

            const rows = tbody.querySelectorAll("tr");
            if (rows.length === 0) {
              console.warn(`Table for ${weekday} has no data rows in tbody`);
              // Check if tbody exists but is empty
              if (tbody.children.length === 0) {
                console.warn(`Table tbody for ${weekday} is completely empty`);
              } else {
                console.warn(
                  `Table tbody for ${weekday} has ${tbody.children.length} children but no <tr> elements`,
                );
              }
              continue;
            }

            console.info(`Found ${rows.length} rows for ${weekday}`);
            dataFound = true;

            for (const row of rows) {
              try {
                const lunch = extractLunchFromElement(row, week, weekday);
                if (lunch) {
                  lunches.push(lunch);
                } else {
                  console.warn(
                    `Failed to extract valid lunch data from row for ${weekday}`,
                  );
                }
              } catch (rowError) {
                console.warn(
                  `Error extracting lunch from table row for ${weekday}:`,
                  rowError,
                );
              }
            }
          } catch (queryError) {
            console.warn(
              `Error querying table for ${weekday} (index ${index}):`,
              queryError,
            );
          }
        }
      } catch (tableError) {
        console.warn("Error during table-based extraction:", tableError);
      }
    }

    // If no table data found, try modern structure (tab-based)
    if (!dataFound) {
      console.info(
        "No table data found, attempting modern structure extraction",
      );

      // Check if container has any headings that might indicate weekday structure
      const allHeadings = container.querySelectorAll("h1, h2, h3, h4, h5, h6");
      if (allHeadings.length === 0) {
        console.warn(
          "No headings found in container - structure may be unexpected",
        );
        // Check what type of elements are in the container
        const childTypes = Array.from(container.children).map((child) =>
          child.tagName.toLowerCase(),
        );
        const uniqueTypes = [...new Set(childTypes)];
        console.warn(`Container children types: ${uniqueTypes.join(", ")}`);
      } else {
        console.info(`Found ${allHeadings.length} headings in container`);
        // Log heading text for debugging
        const headingTexts = Array.from(allHeadings)
          .map((h) => h.textContent?.trim())
          .filter(Boolean);
        console.info(`Heading texts: ${headingTexts.join(", ")}`);
      }

      // Check for common modern structure indicators
      const modernIndicators = container.querySelectorAll(
        ".tab-content, .day-content, [data-day], [data-weekday]",
      );
      if (modernIndicators.length === 0) {
        console.warn(
          "No modern structure indicators found - lunch data may be in unexpected format",
        );
        // Check for any elements with class attributes that might be relevant
        const elementsWithClasses = container.querySelectorAll("[class]");
        if (elementsWithClasses.length > 0) {
          const classNames = Array.from(elementsWithClasses)
            .map((el) => el.className)
            .filter(Boolean)
            .slice(0, 10); // Limit to first 10 for logging
          console.warn(`Found elements with classes: ${classNames.join(", ")}`);
        } else {
          console.warn("No elements with class attributes found in container");
        }
      } else {
        console.info(
          `Found ${modernIndicators.length} modern structure indicators`,
        );
      }

      try {
        for (const weekday of weekdays) {
          try {
            // Validate weekday before processing
            if (!isValidSwedishWeekday(weekday)) {
              console.warn(`Invalid Swedish weekday: ${weekday}`);
              continue;
            }

            const dayElements = findWeekdayContent(container, weekday);
            if (dayElements.length === 0) {
              console.warn(
                `No content elements found for ${weekday} in modern structure`,
              );

              // Enhanced debugging for missing day elements
              console.warn(
                `Attempted to find content for weekday: "${weekday}"`,
              );

              // Check if the weekday text appears anywhere in the container
              const containerText = container.textContent || "";
              if (containerText.toLowerCase().includes(weekday.toLowerCase())) {
                console.warn(
                  `Weekday "${weekday}" text found in container but no structured elements matched`,
                );
              } else {
                console.warn(
                  `Weekday "${weekday}" text not found anywhere in container`,
                );
                // Check for alternative weekday formats
                const alternativeFormats = [
                  weekday.charAt(0).toUpperCase() + weekday.slice(1), // Capitalized
                  weekday.toUpperCase(), // All caps
                  weekday.slice(0, 3), // Abbreviated (mån, tis, etc.)
                ];

                for (const alt of alternativeFormats) {
                  if (containerText.includes(alt)) {
                    console.warn(
                      `Found alternative format "${alt}" for ${weekday} in container text`,
                    );
                    break;
                  }
                }
              }

              continue;
            }

            console.info(
              `Found ${dayElements.length} elements for ${weekday} in modern structure`,
            );

            for (const element of dayElements) {
              try {
                const lunch = extractLunchFromElement(element, week, weekday);
                if (lunch) {
                  lunches.push(lunch);
                  dataFound = true;
                } else {
                  console.warn(
                    `Failed to extract valid lunch data from modern element for ${weekday}`,
                  );
                }
              } catch (elementError) {
                console.warn(
                  `Error extracting lunch from element for ${weekday}:`,
                  elementError,
                );
              }
            }
          } catch (weekdayError) {
            console.warn(`Error processing weekday ${weekday}:`, weekdayError);
          }
        }
      } catch (modernError) {
        console.warn("Error during modern structure extraction:", modernError);
      }

      if (!dataFound) {
        console.warn(
          "No lunch data could be extracted using modern structure methods",
        );
      }
    }
  } catch (error) {
    console.error("Critical error in extractAllLunchData:", error);
  }

  // Validate all extracted lunches before returning
  if (lunches.length > 0) {
    console.log(`Validating ${lunches.length} extracted lunch items...`);
    const validationResult = validateLunches(lunches);

    // Log validation results for debugging
    logValidationResults(validationResult, "Niagara");

    if (validationResult.invalidCount > 0) {
      console.warn(
        `Filtered out ${validationResult.invalidCount} invalid lunch items`,
      );
    }

    return validationResult.validLunches;
  }

  return lunches;
}

/**
 * Try multiple container selectors for compatibility
 * @param {Function} getHtmlNodeFromUrl - Function to fetch HTML content
 * @param {string} url - URL to fetch
 * @returns {Promise<Element|null>} - Container element or null
 */
export async function findLunchContainer(getHtmlNodeFromUrl, url) {
  try {
    if (!getHtmlNodeFromUrl || !url) {
      console.error("Invalid parameters provided to findLunchContainer");
      return null;
    }

    const containerSelectors = [
      "div.lunch", // Original selector
      "section", // Modern semantic selector
      ".lunch-menu", // Semantic class
      "main", // Main content area
      ".content", // Content wrapper
      "#content", // Content by ID
      "body", // Fallback to body
    ];

    let lastError = null;
    let attemptCount = 0;

    for (const selector of containerSelectors) {
      try {
        attemptCount++;
        console.log(
          `Attempting container selector ${attemptCount}/${containerSelectors.length}: ${selector}`,
        );

        const container = await getHtmlNodeFromUrl(url, selector);

        if (container) {
          // Validate container has some content
          if (
            !container.textContent ||
            container.textContent.trim().length === 0
          ) {
            console.warn(
              `Container found with selector ${selector} but has no text content`,
            );
            continue;
          }

          // Check if container has child elements
          if (!container.children || container.children.length === 0) {
            console.warn(
              `Container found with selector ${selector} but has no child elements`,
            );
            continue;
          }

          console.log(
            `Successfully found valid container with selector: ${selector}`,
          );
          console.log(
            `Container has ${container.children.length} child elements and ${container.textContent.trim().length} characters of text`,
          );
          return container;
        } else {
          console.warn(`Selector ${selector} returned null/undefined`);
        }
      } catch (error) {
        lastError = error;
        console.warn(
          `Selector ${selector} failed with error: ${error.message}`,
        );
      }
    }

    // Enhanced error reporting when no container found
    console.error("Could not find lunch container with any selector");
    console.error(
      `Tried ${attemptCount} different selectors: ${containerSelectors.join(", ")}`,
    );

    if (lastError) {
      console.error("Last error encountered:", lastError.message);
    }

    // Try to get basic page info for debugging
    try {
      const bodyElement = await getHtmlNodeFromUrl(url, "body");
      if (bodyElement) {
        const bodyText = bodyElement.textContent || "";
        console.error(`Page body exists with ${bodyText.length} characters`);

        // Check for common error indicators
        if (
          bodyText.toLowerCase().includes("404") ||
          bodyText.toLowerCase().includes("not found")
        ) {
          console.error("Page appears to return 404 Not Found");
        } else if (bodyText.toLowerCase().includes("error")) {
          console.error("Page appears to contain error messages");
        } else if (bodyText.length < 100) {
          console.error("Page has very little content - may be an error page");
        }
      } else {
        console.error(
          "Could not retrieve page body - URL may be invalid or server unreachable",
        );
      }
    } catch (debugError) {
      console.error(
        "Could not retrieve page for debugging:",
        debugError.message,
      );
    }

    return null;
  } catch (error) {
    console.error("Critical error in findLunchContainer:", error);
    return null;
  }
}

/**
 * Main extraction function that handles the complete flow
 * @param {Function} getHtmlNodeFromUrl - Function to fetch HTML content
 * @param {string} url - URL to fetch
 * @returns {Promise<Array<object>>} - Array of lunch objects
 */
export async function extractNiagaraLunches(
  getHtmlNodeFromUrl,
  url = "https://restaurangniagara.se/lunch/",
) {
  try {
    if (!getHtmlNodeFromUrl) {
      console.error(
        "No getHtmlNodeFromUrl function provided to extractNiagaraLunches",
      );
      return [];
    }

    if (!url || typeof url !== "string") {
      console.error("Invalid URL provided to extractNiagaraLunches");
      return [];
    }

    console.log(`Starting lunch extraction from Niagara: ${url}`);

    let container;
    try {
      container = await findLunchContainer(getHtmlNodeFromUrl, url);
    } catch (containerError) {
      console.error("Error finding lunch container:", containerError);
      return [];
    }

    if (!container) {
      console.warn("Lunch container not found, returning empty results");
      return [];
    }

    // Early restaurant status check to provide better logging
    const restaurantStatus = validateRestaurantStatus(container);
    if (!restaurantStatus.isOpen) {
      console.info("Restaurant status check:", restaurantStatus.reason);
      console.info(
        "This is expected behavior when restaurant is closed for vacation or maintenance",
      );
      return []; // Return empty array for closed restaurant - this is normal
    }

    let lunches;
    try {
      lunches = extractAllLunchData(container);
    } catch (extractionError) {
      console.error(
        "Error extracting lunch data from container:",
        extractionError,
      );
      return [];
    }

    const resultCount = lunches ? lunches.length : 0;
    console.log(
      `Successfully extracted and validated ${resultCount} lunch items from Niagara`,
    );

    if (resultCount === 0) {
      console.info(
        "No lunch data extracted - this may be normal if restaurant is closed or has no current menu",
      );
    }

    return lunches || [];
  } catch (error) {
    console.error("Critical error in extractNiagaraLunches:", error);
    return []; // Return empty array for graceful degradation
  }
}
