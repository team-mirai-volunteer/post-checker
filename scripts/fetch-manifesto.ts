#!/usr/bin/env tsx

import { fetchManifesto } from "./src/application/fetchManifestoUsecase.js";

const OUTPUT_DIR = "knowledges/manifesto";

const args = process.argv.slice(2);
let dryRun = false;

for (const arg of args) {
  if (arg === "--dry-run") {
    dryRun = true;
  } else if (arg === "-h" || arg === "--help") {
    console.log(`Usage: fetch-manifesto [options]

Options:
  --dry-run   Simulate without writing files
  -h, --help  Show this help message
`);
    process.exit(0);
  }
}

const result = await fetchManifesto({
  outputDir: OUTPUT_DIR,
  dryRun,
  onProgress: console.log,
});

console.log(
  dryRun
    ? `\nDry run: ${result.savedCount} files would be saved`
    : `\nSaved ${result.savedCount} files to ${OUTPUT_DIR}/`,
);

if (result.skippedCount > 0) {
  console.log(`Skipped ${result.skippedCount} non-target files`);
}

if (result.errorCount > 0) {
  console.error(`${result.errorCount} error(s) occurred`);
  process.exit(1);
}
