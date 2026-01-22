#!/usr/bin/env tsx

import { fetchNoteArticles } from "./src/application/fetchNoteArticlesUsecase.js";

const args = process.argv.slice(2);
let username = "";
let outputDir = "knowledges/note";
let limit: number | undefined;
let dryRun = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "-o" || arg === "--output-dir") outputDir = args[++i] || outputDir;
  else if (arg === "-n" || arg === "--limit") limit = parseInt(args[++i], 10) || undefined;
  else if (arg === "--dry-run") dryRun = true;
  else if (!arg.startsWith("-")) username = arg;
}

if (!username) {
  console.error("Usage: fetch-note-articles <username> [-o dir] [-n limit] [--dry-run]");
  process.exit(1);
}

const result = await fetchNoteArticles({
  username,
  outputDir,
  limit,
  dryRun,
  onProgress: console.log,
});

console.log(
  dryRun
    ? `\nDry run: ${result.savedCount} articles would be saved`
    : `\nSaved ${result.savedCount} articles to ${outputDir}/`,
);

if (result.errorCount > 0) {
  console.error(`${result.errorCount} error(s) occurred`);
  process.exit(1);
}
