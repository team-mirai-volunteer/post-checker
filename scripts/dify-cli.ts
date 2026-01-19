#!/usr/bin/env tsx

import { runSync } from "./src/usecase/sync.js";

interface CliConfig {
  apiUrl: string;
  apiKey: string;
}

function getEnvConfig(): CliConfig {
  const apiUrl = process.env.DIFY_API_URL;
  const apiKey = process.env.DIFY_API_KEY;

  if (!apiUrl) {
    console.error("Error: DIFY_API_URL environment variable is required");
    process.exit(1);
  }

  if (!apiKey) {
    console.error("Error: DIFY_API_KEY environment variable is required");
    process.exit(1);
  }

  return { apiUrl, apiKey };
}

async function syncCommand(): Promise<void> {
  const config = getEnvConfig();

  console.log("Starting sync...\n");

  const results = await runSync({
    baseUrl: config.apiUrl,
    apiKey: config.apiKey,
    configPath: "dify/sync.yaml",
  });

  let totalCreated = 0;
  let totalUpdated = 0;
  let totalDeleted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const result of results) {
    console.log(`Syncing ${result.path}/ → dataset: ${result.datasetId}`);

    totalCreated += result.created;
    totalUpdated += result.updated;
    totalDeleted += result.deleted;
    totalSkipped += result.skipped;
    totalErrors += result.errors.length;

    for (const error of result.errors) {
      console.error(`  [ERROR] ${error.filename}: ${error.error}`);
    }
  }

  console.log(
    `\nSync complete: ${totalCreated} created, ${totalUpdated} updated, ${totalSkipped} unchanged, ${totalDeleted} deleted`
  );

  if (totalErrors > 0) {
    console.error(`\n${totalErrors} error(s) occurred during sync`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "sync":
      await syncCommand();
      break;
    case "list":
    case "export":
    case "import":
      console.error(`dify-cli: '${command}' command not implemented`);
      process.exit(1);
      break;
    default:
      console.error("Usage: dify-cli <command>");
      console.error("");
      console.error("Commands:");
      console.error("  sync     Sync local files to Dify Knowledge Base");
      console.error("  list     List datasets (not implemented)");
      console.error("  export   Export datasets (not implemented)");
      console.error("  import   Import datasets (not implemented)");
      process.exit(1);
  }
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
