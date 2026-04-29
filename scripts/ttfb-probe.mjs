#!/usr/bin/env node
// Synthetic TTFB probe. Two requests; first acts as cold-or-warm sample, second
// is reliably warm. Exits non-zero (fails the GH Actions run) on budget breach.
// No Slack / no external alerting — failed run surfaces via GitHub UI.

import { request } from "node:https";
import { URL } from "node:url";
import { performance } from "node:perf_hooks";

const TARGET = process.env.TARGET_URL || "https://lunch.herremil.com/";
const WARM_BUDGET_MS = Number(process.env.WARM_BUDGET_MS || 200);
const COLD_BUDGET_MS = Number(process.env.COLD_BUDGET_MS || 700);

function probe(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const t0 = performance.now();
    let firstByteAt = null;
    const req = request(
      {
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        method: "GET",
        headers: {
          "User-Agent": "lunch-ttfb-probe",
          Accept: "text/html",
        },
      },
      (res) => {
        res.once("data", () => {
          if (firstByteAt === null) firstByteAt = performance.now();
        });
        res.on("end", () => {
          const ttfb = (firstByteAt ?? performance.now()) - t0;
          resolve({ status: res.statusCode, ttfbMs: Math.round(ttfb) });
        });
        res.resume();
      },
    );
    req.on("error", reject);
    req.end();
  });
}

const cold = await probe(TARGET);
await new Promise((r) => setTimeout(r, 2000));
const warm = await probe(TARGET);

console.log(`cold probe: status=${cold.status} ttfb=${cold.ttfbMs}ms (budget ${COLD_BUDGET_MS}ms)`);
console.log(`warm probe: status=${warm.status} ttfb=${warm.ttfbMs}ms (budget ${WARM_BUDGET_MS}ms)`);

let fail = 0;
if (cold.status >= 400) {
  console.error(`FAIL: cold probe status ${cold.status}`);
  fail = 1;
}
if (warm.status >= 400) {
  console.error(`FAIL: warm probe status ${warm.status}`);
  fail = 1;
}
if (cold.ttfbMs > COLD_BUDGET_MS) {
  console.error(`FAIL: cold TTFB ${cold.ttfbMs}ms > ${COLD_BUDGET_MS}ms`);
  fail = 1;
}
if (warm.ttfbMs > WARM_BUDGET_MS) {
  console.error(`FAIL: warm TTFB ${warm.ttfbMs}ms > ${WARM_BUDGET_MS}ms`);
  fail = 1;
}

process.exit(fail);
