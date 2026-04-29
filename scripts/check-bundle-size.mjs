#!/usr/bin/env node
import { readFileSync, statSync } from "node:fs";

const budgets = JSON.parse(readFileSync(".perf-budgets.json", "utf8"));
let failed = 0;

for (const { path, maxBytes } of budgets.lambdaZips) {
  let size;
  try {
    size = statSync(path).size;
  } catch (e) {
    console.error(`FAIL ${path}: not found (run \`serverless package\` first)`);
    failed = 1;
    continue;
  }
  const mb = (size / 1048576).toFixed(2);
  const capMb = (maxBytes / 1048576).toFixed(2);
  if (size > maxBytes) {
    console.error(`FAIL ${path}: ${mb} MB > ${capMb} MB`);
    failed = 1;
  } else {
    console.log(`ok   ${path}: ${mb} MB / ${capMb} MB cap`);
  }
}

process.exit(failed);
