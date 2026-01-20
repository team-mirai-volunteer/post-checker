import * as fs from "node:fs/promises";
import * as path from "node:path";
import { parse as parseYaml } from "yaml";
import { getAuthWithPlaywright } from "../auth/playwright-auth.js";
import { ConsoleClient } from "../client/console.js";

export interface ImportDslOptions {
  baseUrl: string;
  inputDir: string;
  email?: string;
  password?: string;
  force?: boolean;
  dryRun?: boolean;
  headless?: boolean;
}

export interface ImportResult {
  filename: string;
  appName: string;
  appId?: string;
  status: "created" | "updated" | "skipped" | "failed";
  error?: string;
}

interface DslApp {
  name: string;
  mode?: string;
}

interface DslContent {
  app: DslApp;
}

function extractAppName(yamlContent: string): string | null {
  try {
    const parsed = parseYaml(yamlContent) as DslContent;
    return parsed?.app?.name ?? null;
  } catch {
    return null;
  }
}

export async function importAllDsl(options: ImportDslOptions): Promise<ImportResult[]> {
  const {
    baseUrl,
    inputDir,
    email,
    password,
    force = false,
    dryRun = false,
    headless = false,
  } = options;

  const inputDirExists = await fs
    .access(inputDir)
    .then(() => true)
    .catch(() => false);

  if (!inputDirExists) {
    throw new Error(`Input directory does not exist: ${inputDir}`);
  }

  const files = await fs.readdir(inputDir);
  const ymlFiles = files.filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));

  if (ymlFiles.length === 0) {
    console.log("No DSL files found in input directory.");
    return [];
  }

  console.log(`Found ${ymlFiles.length} DSL file(s).`);

  if (dryRun) {
    console.log("[DRY RUN] Importing DSLs to Dify...\n");
  } else {
    console.log("Importing DSLs to Dify...\n");
  }

  const results: ImportResult[] = [];

  if (dryRun) {
    for (const filename of ymlFiles) {
      const filepath = path.join(inputDir, filename);
      let yamlContent: string;

      try {
        yamlContent = await fs.readFile(filepath, "utf-8");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({
          filename,
          appName: "",
          status: "failed",
          error: `Failed to read file: ${message}`,
        });
        console.error(`  Failed: ${filename} - Failed to read file: ${message}`);
        continue;
      }

      const appName = extractAppName(yamlContent);
      if (!appName) {
        results.push({
          filename,
          appName: "",
          status: "failed",
          error: "Failed to extract app name from YAML",
        });
        console.error(`  Failed: ${filename} - Failed to extract app name from YAML`);
        continue;
      }

      results.push({
        filename,
        appName,
        status: "created",
      });
      console.log(`  Would create: ${filename} -> ${appName}`);
    }
    return results;
  }

  const auth = await getAuthWithPlaywright({ baseUrl, email, password, headless });
  const client = new ConsoleClient({ baseUrl, auth });
  const existingApps = await client.getAllApps();
  const existingAppMap = new Map(existingApps.map((app) => [app.name, app]));

  for (const filename of ymlFiles) {
    const filepath = path.join(inputDir, filename);
    let yamlContent: string;

    try {
      yamlContent = await fs.readFile(filepath, "utf-8");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        filename,
        appName: "",
        status: "failed",
        error: `Failed to read file: ${message}`,
      });
      console.error(`  Failed: ${filename} - Failed to read file: ${message}`);
      continue;
    }

    const appName = extractAppName(yamlContent);
    if (!appName) {
      results.push({
        filename,
        appName: "",
        status: "failed",
        error: "Failed to extract app name from YAML",
      });
      console.error(`  Failed: ${filename} - Failed to extract app name from YAML`);
      continue;
    }

    const existingApp = existingAppMap.get(appName);

    try {
      if (existingApp) {
        if (force) {
          await client.updateAppDsl(existingApp.id, yamlContent);
          results.push({
            filename,
            appName,
            appId: existingApp.id,
            status: "updated",
          });
          console.log(`  Updated: ${filename} -> ${appName} (app_id: ${existingApp.id})`);
        } else {
          results.push({
            filename,
            appName,
            appId: existingApp.id,
            status: "skipped",
          });
          console.log(`  Skipped: ${filename} (already exists, use --force to overwrite)`);
        }
      } else {
        const result = await client.importDsl(yamlContent);
        results.push({
          filename,
          appName,
          appId: result.app_id,
          status: "created",
        });
        console.log(`  Created: ${filename} -> ${appName} (app_id: ${result.app_id})`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        filename,
        appName,
        status: "failed",
        error: message,
      });
      console.error(`  Failed: ${filename} - ${message}`);
    }
  }

  return results;
}
