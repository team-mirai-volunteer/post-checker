import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { DifyDocument } from "../domain/models/difyDocument.js";
import { LocalDocument } from "../domain/models/localDocument.js";
import { SyncResult } from "../domain/models/syncResult.js";
import { type DiffAction, DocumentDiffService } from "../domain/services/documentDiffService.js";
import { DifyKnowledgeClient } from "../infra/difyKnowledgeClient.js";
import type { SyncConfig } from "./types.js";

const BATCH_SIZE = 10;
const INDEXING_POLL_INTERVAL = 2000; // 2秒
const INDEXING_TIMEOUT = 600000; // 10分

export interface RunSyncOptions {
  baseUrl: string;
  apiKey: string;
  configPath: string;
  onProgress?: (message: string) => void;
}

export interface SyncResultData {
  datasetId: string;
  path: string;
  created: number;
  updated: number;
  deleted: number;
  skipped: number;
  errors: Array<{ filename: string; action: DiffAction; error: string }>;
}

export async function runSync(options: RunSyncOptions): Promise<SyncResultData[]> {
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

  const client = new DifyKnowledgeClient({ baseUrl, apiKey });
  const diffService = new DocumentDiffService();
  const results: SyncResultData[] = [];

  for (const dataset of config.datasets) {
    const result = new SyncResult(dataset.dataset_id, dataset.path);

    // ローカルファイル取得
    if (!existsSync(dataset.path)) {
      log(`  [WARN] Path not found: ${dataset.path}`);
      results.push(result.toPlainObject());
      continue;
    }

    const localDocuments = getLocalDocuments(dataset.path);

    // Difyドキュメント取得
    let difyDocuments: DifyDocument[];
    try {
      const apiDocs = await client.listDocuments(dataset.dataset_id);
      difyDocuments = apiDocs.map((doc) => DifyDocument.fromApiResponse(doc));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`  [ERROR] Failed to list documents: ${message}`);
      // Note: Using "skip" as a placeholder for system-level errors
      result.addError("", "skip" as DiffAction, `Failed to list documents: ${message}`);
      results.push(result.toPlainObject());
      continue;
    }

    // 差分計算
    const diffs = diffService.calculateDiff(localDocuments, difyDocuments);

    // アクション別に分類
    const creates = diffs.filter((d) => d.action === "create");
    const updates = diffs.filter((d) => d.action === "update");
    const deletes = diffs.filter((d) => d.action === "delete");
    const skips = diffs.filter((d) => d.action === "skip");

    // SKIP処理
    for (const diff of skips) {
      log(`  [SKIP]   ${diff.filename}`);
      result.incrementSkipped();
    }

    // DELETE処理（インデックス待機不要）
    for (const diff of deletes) {
      try {
        log(`  [DELETE] ${diff.filename}`);
        await client.deleteDocument(dataset.dataset_id, diff.documentId as string);
        result.incrementDeleted();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log(`  [ERROR] ${diff.filename}: ${message}`);
        result.addError(diff.filename, diff.action, message);
      }
    }

    // CREATE処理（バッチ + インデックス待機）
    const createdDocIds: string[] = [];
    for (let i = 0; i < creates.length; i += BATCH_SIZE) {
      const batch = creates.slice(i, i + BATCH_SIZE);
      const batchDocIds: string[] = [];

      for (const diff of batch) {
        try {
          const localDoc = localDocuments.find((d) => d.filename === diff.filename);
          if (!localDoc) continue;
          log(`  [CREATE] ${diff.filename}`);
          const doc = await client.createDocument(
            dataset.dataset_id,
            diff.filename,
            localDoc.content,
            {
              indexing_technique: dataset.indexing_technique,
              process_rule: dataset.process_rule,
            },
          );
          batchDocIds.push(doc.id);
          createdDocIds.push(doc.id);
          result.incrementCreated();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          log(`  [ERROR] ${diff.filename}: ${message}`);
          result.addError(diff.filename, diff.action, message);
        }
      }

      // バッチのインデックス完了を待機
      if (batchDocIds.length > 0) {
        log(`  [WAIT] Waiting for ${batchDocIds.length} documents to be indexed...`);
        await waitForIndexing(client, dataset.dataset_id, batchDocIds, log);
      }
    }

    // UPDATE処理（バッチ + インデックス待機）
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE);
      const batchDocIds: string[] = [];

      for (const diff of batch) {
        try {
          const localDoc = localDocuments.find((d) => d.filename === diff.filename);
          if (!localDoc) continue;
          log(`  [UPDATE] ${diff.filename} (${diff.reason})`);
          const doc = await client.updateDocument(
            dataset.dataset_id,
            diff.documentId as string,
            diff.filename,
            localDoc.content,
          );
          batchDocIds.push(doc.id);
          result.incrementUpdated();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          log(`  [ERROR] ${diff.filename}: ${message}`);
          result.addError(diff.filename, diff.action, message);
        }
      }

      // バッチのインデックス完了を待機
      if (batchDocIds.length > 0) {
        log(`  [WAIT] Waiting for ${batchDocIds.length} documents to be indexed...`);
        await waitForIndexing(client, dataset.dataset_id, batchDocIds, log);
      }
    }

    results.push(result.toPlainObject());
  }

  return results;
}

async function waitForIndexing(
  client: DifyKnowledgeClient,
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

    const apiDocs = await client.listDocuments(datasetId);
    const docs = apiDocs.map((d) => DifyDocument.fromApiResponse(d));

    for (const docId of [...pending]) {
      const doc = docs.find((d) => d.id === docId);
      if (doc?.isIndexingCompleted()) {
        pending.delete(docId);
        log(`  [INDEXED] ${doc.name}`);
      } else if (doc?.isIndexingError()) {
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

function getLocalDocuments(dirPath: string): LocalDocument[] {
  const documents: LocalDocument[] = [];

  const entries = readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".md")) {
      const filePath = join(dirPath, entry.name);
      const content = readFileSync(filePath, "utf-8");
      documents.push(LocalDocument.create(entry.name, filePath, content));
    }
  }

  return documents;
}
