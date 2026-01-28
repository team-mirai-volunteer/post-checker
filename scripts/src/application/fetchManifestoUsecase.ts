import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stringify as yamlStringify } from "yaml";
import {
  fetchFileContent,
  type GitHubContentItem,
  listContents,
} from "../infra/githubContentsClient.js";

const DEFAULT_OWNER = "team-mirai";
const DEFAULT_REPO = "manifesto-body";
const DEFAULT_BRANCH = "shugiin-2026";

export interface ManifestoFileMeta {
  filename: string;
  sha: string;
  url: string;
}

export interface ManifestoIndex {
  source: {
    owner: string;
    repo: string;
    branch: string;
    fetchedAt: string;
  };
  files: ManifestoFileMeta[];
}

export interface FetchManifestoOptions {
  outputDir: string;
  branch?: string;
  dryRun: boolean;
  onProgress?: (msg: string) => void;
}

export interface FetchManifestoResult {
  savedCount: number;
  errorCount: number;
  skippedCount: number;
}

/**
 * 取得対象のファイルか判定
 * - .md ファイルのみ
 * - README.md は除外
 */
export function shouldFetchFile(item: GitHubContentItem): boolean {
  if (item.type !== "file") return false;
  if (!item.name.endsWith(".md")) return false;
  if (item.name.toLowerCase() === "readme.md") return false;
  return true;
}

/**
 * 既存ファイルを削除（index.yaml以外）
 */
function clearOutputDir(outputDir: string, log: (msg: string) => void): void {
  if (!existsSync(outputDir)) return;

  const files = readdirSync(outputDir);
  for (const file of files) {
    if (file === "index.yaml") continue;
    const filePath = join(outputDir, file);
    rmSync(filePath);
    log(`  Removed: ${file}`);
  }
}

/**
 * マニフェストを取得して保存
 */
export async function fetchManifesto(
  options: FetchManifestoOptions,
): Promise<FetchManifestoResult> {
  const { outputDir, branch = DEFAULT_BRANCH, dryRun, onProgress: log = () => {} } = options;

  let savedCount = 0;
  let errorCount = 0;
  let skippedCount = 0;
  const filesMeta: ManifestoFileMeta[] = [];

  // リポジトリのファイル一覧を取得
  log(`Fetching file list from ${DEFAULT_OWNER}/${DEFAULT_REPO}@${branch}...`);
  const contents = await listContents({
    owner: DEFAULT_OWNER,
    repo: DEFAULT_REPO,
    branch,
  });

  // 取得対象をフィルタリング
  const targetFiles = contents.filter(shouldFetchFile);
  log(
    `Found ${targetFiles.length} markdown files (${contents.length - targetFiles.length} skipped)`,
  );

  if (targetFiles.length === 0) {
    log("No files to fetch");
    return { savedCount, errorCount, skippedCount: contents.length };
  }

  // 既存ファイルを削除
  if (!dryRun) {
    if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
    log("Clearing existing files...");
    clearOutputDir(outputDir, log);
  }

  // 各ファイルを取得して保存
  for (let i = 0; i < targetFiles.length; i++) {
    const item = targetFiles[i];
    log(`  [${i + 1}/${targetFiles.length}] ${item.name}`);

    try {
      const content = await fetchFileContent({
        owner: DEFAULT_OWNER,
        repo: DEFAULT_REPO,
        path: item.path,
        branch,
      });

      if (dryRun) {
        log(`    -> Would save: ${item.name}`);
      } else {
        writeFileSync(join(outputDir, item.name), content, "utf-8");
        log(`    -> Saved: ${item.name}`);
      }

      filesMeta.push({
        filename: item.name,
        sha: item.sha,
        url: item.html_url,
      });
      savedCount++;

      // レート制限対策
      if (i < targetFiles.length - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    } catch (e) {
      log(`    -> Error: ${e instanceof Error ? e.message : e}`);
      errorCount++;
    }
  }

  // index.yaml を出力
  if (!dryRun && filesMeta.length > 0) {
    const index: ManifestoIndex = {
      source: {
        owner: DEFAULT_OWNER,
        repo: DEFAULT_REPO,
        branch,
        fetchedAt: new Date().toISOString(),
      },
      files: filesMeta,
    };
    const indexPath = join(outputDir, "index.yaml");
    writeFileSync(indexPath, yamlStringify(index), "utf-8");
    log(`  -> Index: ${indexPath}`);
  }

  skippedCount = contents.length - targetFiles.length;
  return { savedCount, errorCount, skippedCount };
}
