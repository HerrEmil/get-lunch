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

  try {
    // Import our extraction modules
    const { extractNiagaraLunches } = await import("./data-extractor.mjs");

    // Extract lunch data using the new extraction logic
    const extractedLunches = await extractNiagaraLunches(getHtmlNodeFromUrl);
    lunches.push(...extractedLunches);
  } catch (error) {
    console.error("Error extracting lunch data:", error);
    // Continue with empty lunches array for graceful degradation
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
