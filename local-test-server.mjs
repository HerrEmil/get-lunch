/**
 * Local Development Server for Enhanced Lunch Table
 * Fetches live data from all restaurant parsers via ParserFactory
 */

import http from "http";
import { URL } from "url";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { ParserFactory } from "./src/parsers/parser-factory.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const RESTAURANT_CONFIGS = [
  { id: "niagara", name: "Restaurang Niagara", parser: "niagara", url: "https://restaurangniagara.se/lunch/", active: true },
  { id: "spill", name: "Spill", parser: "spill", url: "https://www.restaurangspill.se/", active: true },
  { id: "kontrast", name: "Kontrast", parser: "kontrast", url: "https://www.kontrastrestaurang.se/vastra-hamnen/", active: true },
  { id: "p2", name: "P2", parser: "p2", url: "https://restaurangp2.se/", active: true },
  { id: "taste", name: "Taste", parser: "taste", url: "https://www.tastebynordrest.se/17/6/taste-malmo/", active: true },
  { id: "varv", name: "Varv", parser: "varv", url: "https://varvmalmo.com/menu", active: true },
  { id: "fonderie", name: "La Fonderie", parser: "fonderie", url: "https://www.lafonderie.se/lelunch", active: true },
  { id: "laziza", name: "Laziza", parser: "laziza", url: "https://www.laziza.se/lunch/", active: true },
  { id: "holygreens", name: "Holy Greens", parser: "holygreens", url: "https://holygreens.se/meny/", active: true },
  { id: "kockum", name: "Kockum Fritid", parser: "kockum", url: "https://www.freda49.se/lunch-malmo.html", active: true },
];

const ENGLISH_WEEKDAYS = {
  monday: "måndag", tuesday: "tisdag", wednesday: "onsdag",
  thursday: "torsdag", friday: "fredag", saturday: "lördag", sunday: "söndag",
};

const SWEDISH_WEEKDAYS = {
  måndag: "monday", tisdag: "tuesday", onsdag: "wednesday",
  torsdag: "thursday", fredag: "friday", lördag: "saturday", söndag: "sunday",
};

let cachedData = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function fetchAllLunchData() {
  if (cachedData && Date.now() - cacheTime < CACHE_TTL) {
    console.log("  Using cached data");
    return cachedData;
  }

  const factory = new ParserFactory({
    healthCheck: { enabled: false },
    circuitBreaker: { enabled: true, failureThreshold: 3, timeout: 60000 },
  });

  for (const config of RESTAURANT_CONFIGS) {
    if (!config.active) continue;
    const validation = factory.validateParserConfig(config);
    if (validation.isValid) {
      factory.createParser(config);
    }
  }

  const results = await factory.executeAllParsers({
    parallel: true,
    maxConcurrency: 5,
    continueOnError: true,
  });

  const allData = [];
  for (const result of results) {
    if (result.success && result.lunches.length > 0) {
      allData.push(...result.lunches);
      console.log(`  ${result.restaurant}: ${result.lunches.length} items`);
    } else if (!result.success) {
      console.log(`  ${result.restaurant}: FAILED - ${result.error?.message}`);
    }
  }

  factory.destroy();
  cachedData = allData;
  cacheTime = Date.now();
  console.log(`  Total: ${allData.length} items`);
  return allData;
}

function getHtmlTemplate() {
  return readFileSync(join(__dirname, "index.html"), "utf-8");
}

function filterDataByDay(data, selectedDay) {
  if (!selectedDay || selectedDay === "all") return data;
  const normalized = selectedDay.toLowerCase();
  return data.filter((lunch) => {
    const day = (lunch.weekday || "").toLowerCase();
    return day === normalized || SWEDISH_WEEKDAYS[day] === normalized || ENGLISH_WEEKDAYS[normalized] === day;
  });
}

function getCurrentSwedishWeekday() {
  const englishDay = new Date().toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
  return ENGLISH_WEEKDAYS[englishDay] || "måndag";
}

function getCurrentWeek() {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

const PORT = 3000;

console.log("Local Dev Server — get-lunch");
console.log(`${RESTAURANT_CONFIGS.filter(r => r.active).length} restaurants configured`);

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://localhost:${PORT}`);
  if (url.pathname === "/favicon.ico") { response.writeHead(404); response.end(); return; }

  console.log(`${request.method} ${url.pathname}${url.search}`);
  const startTime = Date.now();

  try {
    const queryParams = Object.fromEntries(url.searchParams);
    const selectedDay = queryParams.day || getCurrentSwedishWeekday();

    const lunchData = await fetchAllLunchData();
    const filtered = filterDataByDay(lunchData, selectedDay);

    const html = getHtmlTemplate();
    const lunchesJson = JSON.stringify(filtered, null, 2);
    const metadata = JSON.stringify({
      lastUpdated: new Date().toISOString(),
      cacheWeek: getCurrentWeek(),
      totalItems: filtered.length,
      restaurants: [...new Set(filtered.map(d => d.place))],
      availableDays: [...new Set(filtered.map(d => d.weekday))],
      dataFreshness: { veryFresh: filtered.length, fresh: 0, stale: 0, veryStale: 0 },
    }, null, 2);

    const responseHtml = html.replace(
      /const lunches = \[\];/,
      `const lunches = ${lunchesJson};\n    const cacheMetadata = ${metadata};\n    console.log("Cache metadata:", cacheMetadata);`,
    );

    const duration = Date.now() - startTime;
    console.log(`  ${filtered.length} items, ${duration}ms`);
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
    response.end(responseHtml);
  } catch (error) {
    console.error("  ERROR:", error.message);
    response.writeHead(500, { "Content-Type": "text/plain" });
    response.end("Error: " + error.message);
  }
});

server.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
  console.log("Data cached for 5 minutes between requests");
});
