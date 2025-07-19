import { extractWeekNumber } from "./week-extractor.mjs";
import {
  SWEDISH_WEEKDAYS,
  isValidSwedishWeekday,
  normalizeSwedishWeekday,
} from "./weekday-mapper.mjs";
import {
  validateLunches,
  validateLunch,
  validateRestaurantStatus,
  logValidationResults,
} from "./data-validator.mjs";
import {
  createWeekdayLogger,
  createRestaurantLogger,
} from "./debug-logger.mjs";

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
  const logger = createWeekdayLogger("Niagara", weekday, {
    operation: "extractLunchFromElement",
    week: week,
  });

  logger.startTimer("extractLunchFromElement");

  try {
    if (!element) {
      logger.warn("No element provided to extractLunchFromElement");
      return null;
    }

    // Check if element has expected properties
    if (!element.tagName) {
      logger.warn(
        "Element missing tagName property - may not be a DOM element",
        {
          elementType: typeof element,
          constructor: element?.constructor?.name,
        },
      );
      return null;
    }

    // Check if element has any content
    if (!element.textContent || element.textContent.trim().length === 0) {
      logger.warn("Element has no text content", {
        tagName: element.tagName,
        hasChildren: element.children && element.children.length > 0,
        childrenCount: element.children ? element.children.length : 0,
      });
      return null;
    }

    let name, description, price;

    // Try table-based extraction (original format)
    if (element.tagName === "TR") {
      // Check if table row has required cells
      const cells = element.querySelectorAll("td");
      if (cells.length < 3) {
        const thCells = element.querySelectorAll("th");
        const cellContents = Array.from(cells).map((cell) =>
          cell.textContent?.trim(),
        );

        logger.warn("Table row missing required cells", {
          cellsFound: cells.length,
          cellsRequired: 3,
          thCellsFound: thCells.length,
          cellContents: cellContents,
        });
        return null;
      }

      const nameCell = element.querySelector("td:nth-of-type(1)");
      const descCell = element.querySelector("td:nth-of-type(2)");
      const priceCell = element.querySelector("td:nth-of-type(3)");

      if (!nameCell || !descCell || !priceCell) {
        logger.warn("Table row missing expected cell structure", {
          nameCell: !!nameCell,
          descCell: !!descCell,
          priceCell: !!priceCell,
          missingCells: [
            !nameCell && "name",
            !descCell && "description",
            !priceCell && "price",
          ].filter(Boolean),
        });
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
        const directText = element.textContent?.trim();
        const childTags = element.children
          ? Array.from(element.children).map((child) =>
              child.tagName.toLowerCase(),
            )
          : [];

        logger.warn("No name element found using any selector", {
          selectorsAttempted: nameSelectors,
          elementStructure: element.outerHTML?.substring(0, 200) + "...",
          childTags: childTags,
          hasDirectText: !!(directText && directText.length > 0),
          directTextPreview: directText?.substring(0, 50) + "...",
        });
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

    // Enhanced validation with detailed logging before returning lunch object
    const validationErrors = [];

    // Validate name
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      validationErrors.push(`Invalid name: "${name}" (type: ${typeof name})`);
    }

    // Validate price
    if (price === null || price === undefined) {
      validationErrors.push("Price is null or undefined");
    } else if (typeof price !== "number" || isNaN(price)) {
      validationErrors.push(
        `Invalid price type: "${price}" (type: ${typeof price})`,
      );
    } else if (price < 0) {
      validationErrors.push(`Price cannot be negative: ${price}`);
    } else if (!isFinite(price)) {
      validationErrors.push(`Price is not finite: ${price}`);
    }

    // Validate week
    if (!week || typeof week !== "number" || isNaN(week)) {
      validationErrors.push(`Invalid week: "${week}" (type: ${typeof week})`);
    } else if (week < 1 || week > 53) {
      validationErrors.push(`Week number out of range: ${week} (must be 1-53)`);
    }

    // Validate weekday
    if (!isValidSwedishWeekday(weekday)) {
      validationErrors.push(`Invalid Swedish weekday: "${weekday}"`);
    }

    // Validate description (optional but if present must be string)
    if (
      description !== undefined &&
      description !== null &&
      typeof description !== "string"
    ) {
      validationErrors.push(
        `Description must be string if provided: "${description}" (type: ${typeof description})`,
      );
    }

    // Log validation errors if any
    if (validationErrors.length > 0) {
      logger.warn("Validation failed for lunch item", {
        errors: validationErrors,
        rawData: { name, price, week, weekday, description },
      });
      return null;
    }

    // Create validated lunch object
    const lunch = {
      description: (description || "").trim(),
      name: name.trim(),
      price: price,
      place: "Niagara",
      week: week,
      weekday: normalizeSwedishWeekday(weekday),
    };

    // Final validation using the validateLunch function for consistency
    const finalValidation = validateLunch(lunch);
    if (!finalValidation.isValid) {
      logger.warn("Final validation failed", {
        errors: finalValidation.errors,
        lunchObject: lunch,
      });
      return null;
    }

    logger.info("Successfully validated lunch item", {
      name: lunch.name,
      price: lunch.price,
      description:
        lunch.description?.substring(0, 50) +
        (lunch.description?.length > 50 ? "..." : ""),
    });

    logger.endTimer("extractLunchFromElement");
    return lunch;
  } catch (error) {
    logger.error("Error extracting lunch data", {}, error);
    logger.endTimer("extractLunchFromElement");
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
  const logger = createRestaurantLogger("Niagara", {
    operation: "extractAllLunchData",
  });
  logger.startTimer("extractAllLunchData");

  const lunches = [];

  try {
    if (!container) {
      logger.error("No container provided to extractAllLunchData");
      return lunches;
    }

    // Check if container has any content
    if (!container.textContent || container.textContent.trim().length === 0) {
      logger.warn("Container is completely empty - no lunch data to extract");
      return lunches;
    }

    // Check restaurant status for closure indicators
    const restaurantStatus = validateRestaurantStatus(container);
    if (!restaurantStatus.isOpen) {
      logger.info("Restaurant is closed", {
        reason: restaurantStatus.reason,
        closureIndicators: restaurantStatus.closureIndicators,
      });
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

            logger.info("Found table rows for weekday", {
              weekday: weekday,
              rowCount: rows.length,
            });
            dataFound = true;

            for (const row of rows) {
              try {
                const lunch = extractLunchFromElement(row, week, weekday);
                if (lunch) {
                  // Validate lunch object before adding to array
                  const validation = validateLunch(lunch);
                  if (validation.isValid) {
                    lunches.push(lunch);
                    console.info(
                      `Added valid lunch item for ${weekday}: "${lunch.name}" - ${lunch.price}kr`,
                    );
                  } else {
                    console.warn(
                      `Extracted lunch for ${weekday} failed validation:`,
                      validation.errors,
                    );
                    console.warn(`Invalid lunch data:`, JSON.stringify(lunch));
                  }
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
                  // Validate lunch object before adding to array
                  const validation = validateLunch(lunch);
                  if (validation.isValid) {
                    lunches.push(lunch);
                    dataFound = true;
                    console.info(
                      `Added valid lunch item for ${weekday}: "${lunch.name}" - ${lunch.price}kr`,
                    );
                  } else {
                    console.warn(
                      `Extracted lunch for ${weekday} failed validation:`,
                      validation.errors,
                    );
                    console.warn(`Invalid lunch data:`, JSON.stringify(lunch));
                  }
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

  // Enhanced validation of all extracted lunches before returning
  if (lunches.length > 0) {
    logger.info("Starting validation of extracted lunch items", {
      itemCount: lunches.length,
    });

    // Pre-validation checks for data integrity
    const preValidationErrors = [];
    for (let i = 0; i < lunches.length; i++) {
      const lunch = lunches[i];
      if (!lunch) {
        preValidationErrors.push(`Lunch at index ${i} is null or undefined`);
      } else if (typeof lunch !== "object") {
        preValidationErrors.push(
          `Lunch at index ${i} is not an object: ${typeof lunch}`,
        );
      }
    }

    if (preValidationErrors.length > 0) {
      console.warn("Pre-validation errors detected:");
      preValidationErrors.forEach((error) => console.warn(`  - ${error}`));
    }

    // Filter out null/undefined entries before main validation
    const validLunchObjects = lunches.filter((lunch, index) => {
      if (!lunch || typeof lunch !== "object") {
        console.warn(`Filtering out invalid lunch object at index ${index}`);
        return false;
      }
      return true;
    });

    if (validLunchObjects.length !== lunches.length) {
      console.warn(
        `Filtered out ${lunches.length - validLunchObjects.length} null/invalid lunch objects`,
      );
    }

    if (validLunchObjects.length === 0) {
      console.warn("No valid lunch objects remaining after filtering");
      return [];
    }

    // Main validation using validateLunches function
    const validationResult = validateLunches(validLunchObjects);

    // Enhanced logging of validation results
    logValidationResults(validationResult, "Niagara");

    // Additional validation checks for edge cases
    if (validationResult.validLunches.length > 0) {
      // Check for duplicate lunch items
      const duplicateCheck = new Map();
      const duplicates = [];

      validationResult.validLunches.forEach((lunch, index) => {
        const key = `${lunch.weekday}-${lunch.name}-${lunch.price}`;
        if (duplicateCheck.has(key)) {
          duplicates.push({
            index: index,
            duplicate: lunch,
            original: duplicateCheck.get(key),
          });
        } else {
          duplicateCheck.set(key, { index, lunch });
        }
      });

      if (duplicates.length > 0) {
        console.warn(
          `Found ${duplicates.length} potential duplicate lunch items:`,
        );
        duplicates.forEach((dup) => {
          console.warn(
            `  - Duplicate at index ${dup.index}: ${dup.duplicate.weekday} - ${dup.duplicate.name}`,
          );
        });
      }

      // Check for reasonable price ranges
      const prices = validationResult.validLunches.map((lunch) => lunch.price);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);

      if (minPrice < 50 || maxPrice > 200) {
        console.warn(
          `Price range check - Min: ${minPrice}kr, Max: ${maxPrice}kr`,
        );
        if (minPrice < 50) {
          console.warn("Some prices seem unusually low (< 50kr)");
        }
        if (maxPrice > 200) {
          console.warn("Some prices seem unusually high (> 200kr)");
        }
      }
    }

    if (validationResult.invalidCount > 0) {
      console.warn(
        `Filtered out ${validationResult.invalidCount} invalid lunch items during validation`,
      );
    }

    logger.logExtractionSummary(validationResult.validLunches);
    logger.endTimer("extractAllLunchData");
    logger.logMetrics();
    return validationResult.validLunches;
  }

  logger.info("No lunch items extracted, returning empty array");
  logger.endTimer("extractAllLunchData");
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
  const logger = createRestaurantLogger("Niagara", {
    operation: "extractNiagaraLunches",
    url: url,
  });

  logger.startTimer("fullExtraction");

  try {
    if (!getHtmlNodeFromUrl) {
      logger.error("No getHtmlNodeFromUrl function provided");
      return [];
    }

    if (!url || typeof url !== "string") {
      logger.error("Invalid URL provided", { url: url, urlType: typeof url });
      return [];
    }

    logger.info("Starting lunch extraction from Niagara", { url });

    let container;
    try {
      container = await findLunchContainer(getHtmlNodeFromUrl, url);
    } catch (containerError) {
      logger.error("Error finding lunch container", {}, containerError);
      return [];
    }

    if (!container) {
      logger.warn("Lunch container not found, returning empty results");
      return [];
    }

    // Early restaurant status check to provide better logging
    const restaurantStatus = validateRestaurantStatus(container);
    if (!restaurantStatus.isOpen) {
      logger.info("Restaurant status check completed", {
        status: "closed",
        reason: restaurantStatus.reason,
        note: "This is expected behavior when restaurant is closed for vacation or maintenance",
      });
      return []; // Return empty array for closed restaurant - this is normal
    }

    let lunches;
    try {
      lunches = extractAllLunchData(container);
    } catch (extractionError) {
      logger.error(
        "Error extracting lunch data from container",
        {},
        extractionError,
      );
      return [];
    }

    const resultCount = lunches ? lunches.length : 0;
    logger.info("Extraction completed", {
      itemsExtracted: resultCount,
      success: resultCount > 0,
    });

    if (resultCount === 0) {
      logger.info("No lunch data extracted", {
        note: "This may be normal if restaurant is closed or has no current menu",
      });
    }

    logger.endTimer("fullExtraction");
    logger.logMetrics();
    return lunches || [];
  } catch (error) {
    logger.error("Critical error in extractNiagaraLunches", {}, error);
    logger.endTimer("fullExtraction");
    return []; // Return empty array for graceful degradation
  }
}
