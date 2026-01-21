#!/usr/bin/env tsx

import "dotenv/config";
import { exportAllDsl } from "./src/application/exportDslUsecase.js";
import { importAllDsl } from "./src/application/importDslUsecase.js";
import { setupDify } from "./src/application/setupDifyUsecase.js";
import { runSync } from "./src/application/syncUsecase.js";
import { clearAuthState } from "./src/auth/playwright-auth.js";

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

async function exportCommand(): Promise<void> {
  const baseUrl = process.env.DIFY_CONSOLE_URL || "http://localhost";
  const email = process.env.DIFY_EMAIL;
  const password = process.env.DIFY_PASSWORD;
  const outputDir = "dify-settings/dsl";
  const knowledgeApiUrl = process.env.DIFY_API_URL;
  const knowledgeApiKey = process.env.DIFY_API_KEY;

  console.log("Exporting DSLs from Dify...\n");

  const results = await exportAllDsl({
    baseUrl,
    outputDir,
    email,
    password,
    includeSecret: false,
    headless: true,
    knowledgeApiUrl,
    knowledgeApiKey,
  });

  const success = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`\nExport complete: ${success} succeeded, ${failed} failed`);
  console.log(`DSLs saved to: ${outputDir}/`);

  if (failed > 0) {
    process.exit(1);
  }
}

interface ImportCommandOptions {
  inputDir: string;
  force: boolean;
  dryRun: boolean;
}

function parseImportArgs(args: string[]): ImportCommandOptions {
  const options: ImportCommandOptions = {
    inputDir: "dify-settings/dsl",
    force: false,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--input-dir" || arg === "-i") {
      options.inputDir = args[++i] || options.inputDir;
    } else if (arg === "--force" || arg === "-f") {
      options.force = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    }
  }

  return options;
}

async function importCommand(args: string[]): Promise<void> {
  const baseUrl = process.env.DIFY_CONSOLE_URL || "http://localhost";
  const email = process.env.DIFY_EMAIL;
  const password = process.env.DIFY_PASSWORD;
  const knowledgeApiUrl = process.env.DIFY_API_URL;
  const knowledgeApiKey = process.env.DIFY_API_KEY;
  const options = parseImportArgs(args);

  const results = await importAllDsl({
    baseUrl,
    inputDir: options.inputDir,
    email,
    password,
    force: options.force,
    dryRun: options.dryRun,
    headless: true,
    knowledgeApiUrl,
    knowledgeApiKey,
  });

  const created = results.filter((r) => r.status === "created").length;
  const updated = results.filter((r) => r.status === "updated").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const failed = results.filter((r) => r.status === "failed").length;

  if (options.dryRun) {
    console.log(
      `\nDry run complete: ${created} would create, ${updated} would update, ${skipped} would skip`,
    );
  } else {
    console.log(
      `\nImport complete: ${created} created, ${updated} updated, ${skipped} skipped, ${failed} failed`,
    );
  }

  if (failed > 0) {
    process.exit(1);
  }
}

async function syncCommand(): Promise<void> {
  const config = getEnvConfig();

  console.log("Starting sync...\n");

  const results = await runSync({
    baseUrl: config.apiUrl,
    apiKey: config.apiKey,
    configPath: "dify-settings/sync.yaml",
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
    `\nSync complete: ${totalCreated} created, ${totalUpdated} updated, ${totalSkipped} unchanged, ${totalDeleted} deleted`,
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
    case "setup":
      await setupDify();
      break;
    case "sync":
      await syncCommand();
      break;
    case "export":
      await exportCommand();
      break;
    case "logout":
      await clearAuthState();
      break;
    case "import":
      await importCommand(args.slice(1));
      break;
    case "list":
      console.error(`dify-cli: '${command}' command not implemented`);
      process.exit(1);
      break;
    default:
      console.error("Usage: dify-cli <command>");
      console.error("");
      console.error("Commands:");
      console.error("  setup    Run initial Dify setup (if not already set up)");
      console.error("  sync     Sync local files to Dify Knowledge Base");
      console.error("  export   Export all app DSLs to dify-settings/dsl/");
      console.error("  import   Import DSLs from dify-settings/dsl/ to Dify");
      console.error("  logout   Clear saved auth session");
      console.error("  list     List datasets (not implemented)");
      process.exit(1);
  }
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
