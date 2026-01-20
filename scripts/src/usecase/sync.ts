import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { KnowledgeClient } from "../client/knowledge.js";
import type { DiffAction, LocalFile, SyncConfig, SyncResult } from "../types.js";
import { calculateDiff, computeHash } from "./diff.js";

const BATCH_SIZE = 10;
const INDEXING_POLL_INTERVAL = 2000; // 2秒
const INDEXING_TIMEOUT = 600000; // 10分

export interface RunSyncOptions {
  baseUrl: string;
  apiKey: string;
  configPath: string;
  onProgress?: (message: string) => void;
}

export async function runSync(options: RunSyncOptions): Promise<SyncResult[]> {
  const { baseUrl, apiKey, configPath, onProgress } = options;
  const log = onProgress ?? (() => {});

  // 設定ファイル読み込み
  if (!existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  const configContent = readFileSync(configPath, "utf-8");
  const config: SyncConfig = parseYaml(configContent);

  if (!config.datasets || !Array.isArray(config.datasets)) {
    throw new Error(`Invalid config: 'datasets' array is required`);
  }

  const client = new KnowledgeClient({ baseUrl, apiKey });
  const results: SyncResult[] = [];

  // dataset名からIDを解決するためのマップを作成
  log("Fetching dataset list...");
  const allDatasets = await client.listDatasets();
  const datasetNameToId = new Map(allDatasets.map((d) => [d.name, d.id]));

  for (const dataset of config.datasets) {
    // dataset_nameからIDを解決（存在しない場合は作成）
    let datasetId = datasetNameToId.get(dataset.dataset_name);
    if (!datasetId) {
      log(`  [CREATE_DATASET] ${dataset.dataset_name}`);
      try {
        const newDataset = await client.createDataset({
          name: dataset.dataset_name,
          indexing_technique: dataset.indexing_technique,
        });
        datasetId = newDataset.id;
        datasetNameToId.set(dataset.dataset_name, datasetId);
        log(`  [CREATED] Dataset ${dataset.dataset_name} (${datasetId})`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log(`  [ERROR] Failed to create dataset: ${message}`);
        results.push({
          datasetId: "",
          path: dataset.path,
          created: 0,
          updated: 0,
          deleted: 0,
          skipped: 0,
          errors: [
            {
              filename: "",
              action: "skip" as DiffAction,
              error: `Failed to create dataset: ${message}`,
            },
          ],
        });
        continue;
      }
    }

    const result: SyncResult = {
      datasetId,
      path: dataset.path,
      created: 0,
      updated: 0,
      deleted: 0,
      skipped: 0,
      errors: [],
    };

    // ローカルファイル取得
    if (!existsSync(dataset.path)) {
      log(`  [WARN] Path not found: ${dataset.path}`);
      results.push(result);
      continue;
    }

    const localFiles = getLocalFiles(dataset.path);

    // Difyドキュメント取得
    let difyDocuments: Awaited<ReturnType<typeof client.listDocuments>>;
    try {
      difyDocuments = await client.listDocuments(datasetId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`  [ERROR] Failed to list documents: ${message}`);
      result.errors.push({
        filename: "",
        action: "skip" as DiffAction,
        error: `Failed to list documents: ${message}`,
      });
      results.push(result);
      continue;
    }

    // 差分計算
    const diffs = calculateDiff(localFiles, difyDocuments);

    // アクション別に分類
    const creates = diffs.filter((d) => d.action === "create");
    const updates = diffs.filter((d) => d.action === "update");
    const deletes = diffs.filter((d) => d.action === "delete");
    const skips = diffs.filter((d) => d.action === "skip");

    // SKIP処理
    for (const diff of skips) {
      log(`  [SKIP]   ${diff.filename}`);
      result.skipped++;
    }

    // DELETE処理（インデックス待機不要）
    for (const diff of deletes) {
      try {
        log(`  [DELETE] ${diff.filename}`);
        await client.deleteDocument(datasetId, diff.documentId as string);
        result.deleted++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log(`  [ERROR] ${diff.filename}: ${message}`);
        result.errors.push({
          filename: diff.filename,
          action: diff.action,
          error: message,
        });
      }
    }

    // CREATE処理（バッチ + インデックス待機）
    const createdDocIds: string[] = [];
    for (let i = 0; i < creates.length; i += BATCH_SIZE) {
      const batch = creates.slice(i, i + BATCH_SIZE);
      const batchDocIds: string[] = [];

      for (const diff of batch) {
        try {
          const localFile = localFiles.find((f) => f.filename === diff.filename);
          if (!localFile) continue;
          log(`  [CREATE] ${diff.filename}`);
          const doc = await client.createDocument(datasetId, diff.filename, localFile.content, {
            indexing_technique: dataset.indexing_technique,
            process_rule: dataset.process_rule,
          });
          batchDocIds.push(doc.id);
          createdDocIds.push(doc.id);
          result.created++;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          log(`  [ERROR] ${diff.filename}: ${message}`);
          result.errors.push({
            filename: diff.filename,
            action: diff.action,
            error: message,
          });
        }
      }

      // バッチのインデックス完了を待機
      if (batchDocIds.length > 0) {
        log(`  [WAIT] Waiting for ${batchDocIds.length} documents to be indexed...`);
        await waitForIndexing(client, datasetId, batchDocIds, log);
      }
    }

    // UPDATE処理（バッチ + インデックス待機）
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE);
      const batchDocIds: string[] = [];

      for (const diff of batch) {
        try {
          const localFile = localFiles.find((f) => f.filename === diff.filename);
          if (!localFile) continue;
          log(`  [UPDATE] ${diff.filename} (${diff.reason})`);
          const doc = await client.updateDocument(
            datasetId,
            diff.documentId as string,
            diff.filename,
            localFile.content,
          );
          batchDocIds.push(doc.id);
          result.updated++;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          log(`  [ERROR] ${diff.filename}: ${message}`);
          result.errors.push({
            filename: diff.filename,
            action: diff.action,
            error: message,
          });
        }
      }

      // バッチのインデックス完了を待機
      if (batchDocIds.length > 0) {
        log(`  [WAIT] Waiting for ${batchDocIds.length} documents to be indexed...`);
        await waitForIndexing(client, datasetId, batchDocIds, log);
      }
    }

    results.push(result);
  }

  return results;
}

async function waitForIndexing(
  client: KnowledgeClient,
  datasetId: string,
  docIds: string[],
  log: (msg: string) => void,
): Promise<void> {
  const start = Date.now();
  const pending = new Set(docIds);

  while (pending.size > 0) {
    if (Date.now() - start > INDEXING_TIMEOUT) {
      throw new Error(`Timeout waiting for indexing (${pending.size} documents remaining)`);
    }

    const docs = await client.listDocuments(datasetId);

    for (const docId of [...pending]) {
      const doc = docs.find((d) => d.id === docId);
      if (doc?.indexing_status === "completed") {
        pending.delete(docId);
        log(`  [INDEXED] ${doc.name}`);
      } else if (doc?.indexing_status === "error") {
        pending.delete(docId);
        log(`  [INDEX_ERROR] ${doc.name}: ${doc.error}`);
      }
    }

    if (pending.size > 0) {
      await sleep(INDEXING_POLL_INTERVAL);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getLocalFiles(dirPath: string): LocalFile[] {
  const files: LocalFile[] = [];

  const entries = readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".md")) {
      const filePath = join(dirPath, entry.name);
      const content = readFileSync(filePath, "utf-8");
      files.push({
        filename: entry.name,
        path: filePath,
        content,
        hash: computeHash(content),
      });
    }
  }

  return files;
}
