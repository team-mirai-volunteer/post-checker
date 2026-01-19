// DSLエクスポート usecase
import * as fs from "fs/promises";
import * as path from "path";
import { ConsoleClient, type ConsoleApp } from "../client/console.js";
import {
  getAuthWithPlaywright,
  type AuthOptions,
} from "../auth/playwright-auth.js";

export interface ExportDslOptions {
  baseUrl: string;
  outputDir: string;
  email?: string;
  password?: string;
  includeSecret?: boolean;
  headless?: boolean;
  appFilter?: (app: ConsoleApp) => boolean;
}

export interface ExportResult {
  appId: string;
  appName: string;
  filename: string;
  success: boolean;
  error?: string;
}

/**
 * 全アプリのDSLをエクスポートする
 */
export async function exportAllDsl(
  options: ExportDslOptions
): Promise<ExportResult[]> {
  const { baseUrl, outputDir, email, password, includeSecret = false, headless = false } = options;

  // 1. Playwright で認証情報を取得
  const auth = await getAuthWithPlaywright({ baseUrl, email, password, headless });

  // 2. Console API クライアントを作成
  const client = new ConsoleClient({ baseUrl, auth });

  // 3. アプリ一覧を取得
  let apps = await client.getAllApps();
  console.log(`Found ${apps.length} app(s).`);

  // フィルタがあれば適用
  if (options.appFilter) {
    apps = apps.filter(options.appFilter);
    console.log(`After filter: ${apps.length} app(s).`);
  }

  // 4. 出力ディレクトリを作成
  await fs.mkdir(outputDir, { recursive: true });

  // 5. 各アプリのDSLをエクスポート
  const results: ExportResult[] = [];

  for (const app of apps) {
    const filename = sanitizeFilename(app.name) + ".yml";
    const filepath = path.join(outputDir, filename);

    try {
      const dsl = await client.exportDsl(app.id, includeSecret);
      await fs.writeFile(filepath, dsl, "utf-8");

      results.push({
        appId: app.id,
        appName: app.name,
        filename,
        success: true,
      });

      console.log(`  Exported: ${app.name} → ${filename}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        appId: app.id,
        appName: app.name,
        filename,
        success: false,
        error: message,
      });

      console.error(`  Failed: ${app.name} - ${message}`);
    }
  }

  return results;
}

/**
 * ファイル名として安全な文字列に変換
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, "-")
    .toLowerCase();
}
