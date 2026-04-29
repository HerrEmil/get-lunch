#!/usr/bin/env node
// Block staged images > 200 KB. Mirrors perf-config asset-guard threshold.
import { statSync } from "node:fs";

const MAX = 200 * 1024;
const files = process.argv.slice(2);
const fails = [];

for (const f of files) {
  const size = statSync(f).size;
  if (size > MAX) {
    fails.push(`  ${f}  ${(size / 1024).toFixed(1)} KB`);
  }
}

if (fails.length) {
  console.error(`check-image-size: ${fails.length} image(s) exceed 200 KB cap:`);
  console.error(fails.join("\n"));
  process.exit(1);
}
