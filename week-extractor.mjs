/**
 * Updated week extraction to handle new format "Vecka 20250714"
 * @param {Element} container
 * @returns {number}
 */
export function extractWeekNumber(container) {
  try {
    if (!container) {
      console.warn(
        "No container provided to extractWeekNumber, using current week",
      );
      return getCurrentWeek();
    }

    // Check if container has any potential week elements
    const potentialElements = container.querySelectorAll("*");
    if (potentialElements.length === 0) {
      console.warn("Container has no elements at all - cannot extract week");
      return getCurrentWeek();
    }

    // Try new format first: "Vecka 20250714"
    let weekElement;
    try {
      weekElement = container.querySelector("h3, h2, .week-header");
    } catch (selectorError) {
      console.warn("Error querying for week element:", selectorError);
      return getCurrentWeek();
    }

    if (!weekElement) {
      console.warn(
        "No week element found with primary selectors, trying fallback selectors",
      );

      // Try fallback selectors for week information
      const fallbackSelectors = [
        "h1",
        "h4",
        "h5",
        "h6",
        ".header",
        ".title",
        "[class*='week']",
        "[id*='week']",
      ];

      for (const selector of fallbackSelectors) {
        try {
          const fallbackElement = container.querySelector(selector);
          if (
            fallbackElement &&
            fallbackElement.textContent &&
            fallbackElement.textContent.includes("Vecka")
          ) {
            console.info(
              `Found week information using fallback selector: ${selector}`,
            );
            weekElement = fallbackElement;
            break;
          }
        } catch (fallbackError) {
          console.warn(`Fallback selector ${selector} failed:`, fallbackError);
        }
      }

      if (!weekElement) {
        console.warn(
          "No week element found with any selector - checking for week info in any text",
        );

        // Last resort: search for "Vecka" in any text content
        const allElements = container.querySelectorAll("*");
        for (const element of allElements) {
          if (element.textContent && element.textContent.includes("Vecka")) {
            console.info("Found week information in element text content");
            weekElement = element;
            break;
          }
        }
      }
    }

    if (weekElement) {
      let weekText;
      try {
        weekText = weekElement.textContent;
        if (!weekText || typeof weekText !== "string") {
          console.warn("Week element has no valid text content");
          return getCurrentWeek();
        }

        if (weekText.trim().length === 0) {
          console.warn("Week element text content is empty or whitespace only");
          return getCurrentWeek();
        }

        if (!weekText.includes("Vecka")) {
          console.warn(
            `Week element text "${weekText}" does not contain "Vecka"`,
          );
          return getCurrentWeek();
        }
      } catch (textError) {
        console.warn("Error accessing week element text content:", textError);
        return getCurrentWeek();
      }

      // New format: "Vecka 20250714" - extract week from date
      try {
        const newFormatMatch = weekText.match(/Vecka (\d{8})/);
        if (newFormatMatch) {
          const dateStr = newFormatMatch[1];

          // Validate date string
          if (dateStr.length !== 8) {
            console.warn(`Invalid date string length: ${dateStr}`);
          } else {
            try {
              const year = parseInt(dateStr.substring(0, 4));
              const month = parseInt(dateStr.substring(4, 6)) - 1; // Month is 0-based
              const day = parseInt(dateStr.substring(6, 8));

              // Validate parsed values
              if (isNaN(year) || isNaN(month) || isNaN(day)) {
                console.warn(
                  `Invalid date components: year=${year}, month=${month + 1}, day=${day}`,
                );
              } else if (year < 1900 || year > 2100) {
                console.warn(`Year out of reasonable range: ${year}`);
              } else if (month < 0 || month > 11) {
                console.warn(`Month out of valid range: ${month + 1}`);
              } else if (day < 1 || day > 31) {
                console.warn(`Day out of valid range: ${day}`);
              } else {
                const date = new Date(year, month, day);

                // Validate that the date object is valid
                if (isNaN(date.getTime())) {
                  console.warn(`Invalid date object created from: ${dateStr}`);
                } else {
                  // Calculate week number using ISO week calculation
                  const startDate = new Date(date.getFullYear(), 0, 1);
                  const days = Math.floor(
                    (date - startDate) / (24 * 60 * 60 * 1000),
                  );
                  const calculatedWeek = Math.ceil(
                    (days + startDate.getDay() + 1) / 7,
                  );

                  if (calculatedWeek >= 1 && calculatedWeek <= 53) {
                    return calculatedWeek;
                  } else {
                    console.warn(
                      `Calculated week out of valid range: ${calculatedWeek}`,
                    );
                  }
                }
              }
            } catch (dateError) {
              console.warn("Error calculating week from date:", dateError);
            }
          }
        }
      } catch (newFormatError) {
        console.warn("Error processing new format week:", newFormatError);
      }

      // Old format: "Vecka XX"
      try {
        const oldFormatMatch = weekText.match(/Vecka (\d{1,2})/);
        if (oldFormatMatch) {
          const weekNumber = parseInt(oldFormatMatch[1]);
          if (!isNaN(weekNumber) && weekNumber >= 1 && weekNumber <= 53) {
            return weekNumber;
          } else {
            console.warn(`Week number out of valid range: ${weekNumber}`);
          }
        }
      } catch (oldFormatError) {
        console.warn("Error processing old format week:", oldFormatError);
      }
    }

    // Fallback to current week
    console.warn(
      "No valid week found in container - all week detection methods failed, using current week fallback",
    );
    return getCurrentWeek();
  } catch (error) {
    console.error("Critical error in extractWeekNumber:", error);
    return getCurrentWeek();
  }
}

/**
 * Helper function to get current week number with error handling
 * @returns {number} - Current week number
 */
function getCurrentWeek() {
  try {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now - startDate) / (24 * 60 * 60 * 1000));
    const currentWeek = Math.ceil((days + startDate.getDay() + 1) / 7);

    // Validate current week calculation
    if (currentWeek >= 1 && currentWeek <= 53) {
      return currentWeek;
    } else {
      console.warn(
        `Current week calculation out of range: ${currentWeek}, using week 1`,
      );
      return 1;
    }
  } catch (error) {
    console.error("Error calculating current week:", error);
    return 1; // Ultimate fallback
  }
}

/**
 * Test function to validate week extraction with different formats
 * @param {string} weekText - Text content to test
 * @returns {object} - Test results
 */
export function testWeekExtraction(weekText) {
  const results = {
    input: weekText,
    newFormat: null,
    oldFormat: null,
    extracted: null,
  };

  // Test new format: "Vecka 20250714"
  const newFormatMatch = weekText.match(/Vecka (\d{8})/);
  if (newFormatMatch) {
    results.newFormat = newFormatMatch[1];
    const dateStr = newFormatMatch[1];
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));
    const date = new Date(year, month, day);

    const startDate = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date - startDate) / (24 * 60 * 60 * 1000));
    results.extracted = Math.ceil((days + startDate.getDay() + 1) / 7);
  }

  // Test old format: "Vecka XX"
  const oldFormatMatch = weekText.match(/Vecka (\d{1,2})/);
  if (oldFormatMatch) {
    results.oldFormat = oldFormatMatch[1];
    if (!results.extracted) {
      results.extracted = parseInt(oldFormatMatch[1]);
    }
  }

  return results;
}
