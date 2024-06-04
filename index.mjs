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
   * @param {Element} row
   * @param {number} week
   * @param {string} weekday
   */
  function addNiagaraRowToLunches(row, week, weekday) {
    const name = row.querySelector("td:nth-of-type(1)").textContent;
    const description = row
      .querySelector("td:nth-of-type(2)")
      .textContent.split("\n")[0];
    const price = Number(
      row.querySelector("td:nth-of-type(3)").textContent.split(":-")[0]
    );

    lunches.push({
      description,
      name,
      price,
      place: "Niagara",
      week,
      weekday,
    });
  }

  await getHtmlNodeFromUrl(
    "https://restaurangniagara.se/lunch/",
    "div.lunch"
  ).then((lunchNode) => {
    const week = Number(
      lunchNode
        .querySelector("h2")
        .textContent.split("Vecka ")
        .pop()
        .split(" ")[0]
    );

    const weekdays = ["måndag", "tisdag", "onsdag", "torsdag", "fredag"];

    for (const [index, weekday] of weekdays.entries()) {
      const rows = lunchNode.querySelectorAll(
        `table:nth-of-type(${index + 1}) tbody tr`
      );
      [...rows].forEach((row) => {
        addNiagaraRowToLunches(row, week, weekday);
      });
    }
  });

  const body = fs
    .readFileSync(path.resolve(__dirname, "./index.html"), {
      encoding: "utf-8",
    })
    .replace(
      "const lunches = [];",
      `const lunches = ${JSON.stringify(lunches)};`
    );

  return {
    statusCode: 200,
    body,
  };
};
