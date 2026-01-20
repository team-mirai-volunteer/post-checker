import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockListDatasets,
  mockListDocuments,
  mockCreateDocument,
  mockUpdateDocument,
  mockDeleteDocument,
} = vi.hoisted(() => ({
  mockListDatasets: vi.fn(),
  mockListDocuments: vi.fn(),
  mockCreateDocument: vi.fn(),
  mockUpdateDocument: vi.fn(),
  mockDeleteDocument: vi.fn(),
}));

vi.mock("../../../src/infra/difyKnowledgeClient.js", () => {
  return {
    DifyKnowledgeClient: class {
      listDatasets = mockListDatasets;
      listDocuments = mockListDocuments;
      createDocument = mockCreateDocument;
      updateDocument = mockUpdateDocument;
      deleteDocument = mockDeleteDocument;
    },
  };
});

import { runSync } from "../../../src/application/syncUsecase.js";

const TEST_DIR = "/tmp/dify-sync-test";
const CONFIG_PATH = join(TEST_DIR, "sync.yaml");
const KNOWLEDGE_DIR = join(TEST_DIR, "knowledges");

describe("runSync", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(KNOWLEDGE_DIR, { recursive: true });
    vi.clearAllMocks();
    // デフォルトでtest-datasetを返す
    mockListDatasets.mockResolvedValue([
      { id: "test-dataset", name: "test-dataset" },
      { id: "dataset-1", name: "dataset-1" },
      { id: "dataset-2", name: "dataset-2" },
    ]);
    mockListDocuments.mockResolvedValue([]);
    mockCreateDocument.mockResolvedValue({
      id: "new-doc-id",
      name: "test.md",
      indexing_status: "completed",
    });
    mockUpdateDocument.mockResolvedValue({
      id: "existing-doc-id",
      name: "test.md",
      indexing_status: "completed",
    });
    mockDeleteDocument.mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe("設定ファイルのバリデーション", () => {
    it("設定ファイルが存在しない場合はエラー", async () => {
      await expect(
        runSync({
          baseUrl: "http://localhost",
          apiKey: "test-key",
          configPath: "/nonexistent/sync.yaml",
        }),
      ).rejects.toThrow("Config file not found");
    });

    it("設定ファイルにdatasetsがない場合はエラー", async () => {
      writeFileSync(CONFIG_PATH, "invalid: config\n");

      await expect(
        runSync({
          baseUrl: "http://localhost",
          apiKey: "test-key",
          configPath: CONFIG_PATH,
        }),
      ).rejects.toThrow("'datasets' array is required");
    });

    it("指定パスが存在しない場合は警告してスキップ", async () => {
      writeFileSync(
        CONFIG_PATH,
        `
datasets:
  - path: /nonexistent/path
    dataset_name: test-dataset
`,
      );

      const logs: string[] = [];
      const results = await runSync({
        baseUrl: "http://localhost",
        apiKey: "test-key",
        configPath: CONFIG_PATH,
        onProgress: (msg) => logs.push(msg),
      });

      expect(results).toHaveLength(1);
      expect(results[0].path).toBe("/nonexistent/path");
      expect(logs.some((l) => l.includes("WARN") && l.includes("not found"))).toBe(true);
    });
  });

  describe("CREATE操作", () => {
    it("新規ファイルをCREATEする", async () => {
      const testDir = join(KNOWLEDGE_DIR, "test");
      mkdirSync(testDir);
      writeFileSync(join(testDir, "new-doc.md"), "# New Document\n\nContent here");

      writeFileSync(
        CONFIG_PATH,
        `
datasets:
  - path: ${testDir}
    dataset_name: test-dataset
`,
      );

      // 最初の呼び出し: Difyに既存ドキュメントはない
      // 2回目以降: waitForIndexingでインデックス完了状態を返す
      mockListDocuments
        .mockResolvedValueOnce([]) // 差分計算用
        .mockResolvedValue([
          // waitForIndexing用: インデックス完了
          { id: "new-doc-id", name: "new-doc.md", indexing_status: "completed" },
        ]);

      const logs: string[] = [];
      const results = await runSync({
        baseUrl: "http://localhost",
        apiKey: "test-key",
        configPath: CONFIG_PATH,
        onProgress: (msg) => logs.push(msg),
      });

      expect(results).toHaveLength(1);
      expect(results[0].created).toBe(1);
      expect(mockCreateDocument).toHaveBeenCalledWith(
        "test-dataset",
        "new-doc.md",
        "# New Document\n\nContent here",
        expect.any(Object),
      );
      expect(logs.some((l) => l.includes("CREATE"))).toBe(true);
    });
  });

  describe("UPDATE操作", () => {
    it("ハッシュが異なる場合はUPDATEする", async () => {
      const testDir = join(KNOWLEDGE_DIR, "test");
      mkdirSync(testDir);
      writeFileSync(join(testDir, "existing.md"), "# Updated Content");

      writeFileSync(
        CONFIG_PATH,
        `
datasets:
  - path: ${testDir}
    dataset_name: test-dataset
`,
      );

      // Difyに既存ドキュメントがある（ハッシュが異なる）
      // 最初: 差分計算用、2回目以降: waitForIndexing用
      mockListDocuments
        .mockResolvedValueOnce([
          {
            id: "existing-doc-id",
            name: "existing.md",
            indexing_status: "completed",
            doc_metadata: { source_hash: "old-hash" },
          },
        ])
        .mockResolvedValue([
          // waitForIndexing用: インデックス完了
          { id: "existing-doc-id", name: "existing.md", indexing_status: "completed" },
        ]);

      const logs: string[] = [];
      const results = await runSync({
        baseUrl: "http://localhost",
        apiKey: "test-key",
        configPath: CONFIG_PATH,
        onProgress: (msg) => logs.push(msg),
      });

      expect(results).toHaveLength(1);
      expect(results[0].updated).toBe(1);
      expect(mockUpdateDocument).toHaveBeenCalledWith(
        "test-dataset",
        "existing-doc-id",
        "existing.md",
        "# Updated Content",
      );
      expect(logs.some((l) => l.includes("UPDATE"))).toBe(true);
    });
  });

  describe("DELETE操作", () => {
    it("ローカルにないドキュメントをDELETEする", async () => {
      const testDir = join(KNOWLEDGE_DIR, "test");
      mkdirSync(testDir);
      // ローカルにはファイルなし

      writeFileSync(
        CONFIG_PATH,
        `
datasets:
  - path: ${testDir}
    dataset_name: test-dataset
`,
      );

      // Difyにはドキュメントがある
      mockListDocuments.mockResolvedValue([
        {
          id: "orphan-doc-id",
          name: "orphan.md",
          indexing_status: "completed",
        },
      ]);

      const logs: string[] = [];
      const results = await runSync({
        baseUrl: "http://localhost",
        apiKey: "test-key",
        configPath: CONFIG_PATH,
        onProgress: (msg) => logs.push(msg),
      });

      expect(results).toHaveLength(1);
      expect(results[0].deleted).toBe(1);
      expect(mockDeleteDocument).toHaveBeenCalledWith("test-dataset", "orphan-doc-id");
      expect(logs.some((l) => l.includes("DELETE"))).toBe(true);
    });
  });

  describe("SKIP操作", () => {
    it("ハッシュが一致する場合はSKIPする", async () => {
      const testDir = join(KNOWLEDGE_DIR, "test");
      mkdirSync(testDir);
      const content = "# Same Content";
      writeFileSync(join(testDir, "same.md"), content);

      writeFileSync(
        CONFIG_PATH,
        `
datasets:
  - path: ${testDir}
    dataset_name: test-dataset
`,
      );

      // LocalDocument.create と同じハッシュ計算
      const crypto = await import("node:crypto");
      const hash = crypto.createHash("sha256").update(content, "utf8").digest("hex");

      mockListDocuments.mockResolvedValue([
        {
          id: "same-doc-id",
          name: "same.md",
          indexing_status: "completed",
          doc_metadata: { source_hash: hash },
        },
      ]);

      const logs: string[] = [];
      const results = await runSync({
        baseUrl: "http://localhost",
        apiKey: "test-key",
        configPath: CONFIG_PATH,
        onProgress: (msg) => logs.push(msg),
      });

      expect(results).toHaveLength(1);
      expect(results[0].skipped).toBe(1);
      expect(mockCreateDocument).not.toHaveBeenCalled();
      expect(mockUpdateDocument).not.toHaveBeenCalled();
      expect(logs.some((l) => l.includes("SKIP"))).toBe(true);
    });
  });

  describe("エラーハンドリング", () => {
    it("listDocuments失敗時はエラーを記録してスキップ", async () => {
      const testDir = join(KNOWLEDGE_DIR, "test");
      mkdirSync(testDir);
      writeFileSync(join(testDir, "test.md"), "content");

      writeFileSync(
        CONFIG_PATH,
        `
datasets:
  - path: ${testDir}
    dataset_name: test-dataset
`,
      );

      mockListDocuments.mockRejectedValue(new Error("API connection failed"));

      const logs: string[] = [];
      const results = await runSync({
        baseUrl: "http://localhost",
        apiKey: "test-key",
        configPath: CONFIG_PATH,
        onProgress: (msg) => logs.push(msg),
      });

      expect(results).toHaveLength(1);
      expect(results[0].errors).toHaveLength(1);
      expect(results[0].errors[0].error).toContain("API connection failed");
      expect(logs.some((l) => l.includes("ERROR"))).toBe(true);
    });

    it("createDocument失敗時はエラーを記録して続行", async () => {
      const testDir = join(KNOWLEDGE_DIR, "test");
      mkdirSync(testDir);
      writeFileSync(join(testDir, "fail.md"), "content");

      writeFileSync(
        CONFIG_PATH,
        `
datasets:
  - path: ${testDir}
    dataset_name: test-dataset
`,
      );

      mockListDocuments.mockResolvedValue([]);
      mockCreateDocument.mockRejectedValue(new Error("Create failed"));

      const results = await runSync({
        baseUrl: "http://localhost",
        apiKey: "test-key",
        configPath: CONFIG_PATH,
      });

      expect(results).toHaveLength(1);
      expect(results[0].created).toBe(0);
      expect(results[0].errors).toHaveLength(1);
      expect(results[0].errors[0].filename).toBe("fail.md");
      expect(results[0].errors[0].error).toBe("Create failed");
    });
  });

  describe("複数データセット", () => {
    it("複数のデータセットを順番に処理する", async () => {
      const testDir1 = join(KNOWLEDGE_DIR, "dataset1");
      const testDir2 = join(KNOWLEDGE_DIR, "dataset2");
      mkdirSync(testDir1);
      mkdirSync(testDir2);
      writeFileSync(join(testDir1, "doc1.md"), "content1");
      writeFileSync(join(testDir2, "doc2.md"), "content2");

      writeFileSync(
        CONFIG_PATH,
        `
datasets:
  - path: ${testDir1}
    dataset_name: dataset-1
  - path: ${testDir2}
    dataset_name: dataset-2
`,
      );

      // createDocumentはそれぞれ異なるIDを返す
      mockCreateDocument
        .mockResolvedValueOnce({
          id: "new-doc-id-1",
          name: "doc1.md",
          indexing_status: "completed",
        })
        .mockResolvedValueOnce({
          id: "new-doc-id-2",
          name: "doc2.md",
          indexing_status: "completed",
        });

      // listDocumentsの呼び出し順序
      mockListDocuments
        .mockResolvedValueOnce([]) // dataset-1 差分計算
        .mockResolvedValueOnce([
          // dataset-1 waitForIndexing
          { id: "new-doc-id-1", name: "doc1.md", indexing_status: "completed" },
        ])
        .mockResolvedValueOnce([]) // dataset-2 差分計算
        .mockResolvedValueOnce([
          // dataset-2 waitForIndexing
          { id: "new-doc-id-2", name: "doc2.md", indexing_status: "completed" },
        ]);

      const results = await runSync({
        baseUrl: "http://localhost",
        apiKey: "test-key",
        configPath: CONFIG_PATH,
      });

      expect(results).toHaveLength(2);
      expect(results[0].datasetId).toBe("dataset-1");
      expect(results[0].created).toBe(1);
      expect(results[1].datasetId).toBe("dataset-2");
      expect(results[1].created).toBe(1);
    });
  });

  describe("空ディレクトリ", () => {
    it("空のディレクトリの場合は何もしない", async () => {
      const emptyDir = join(KNOWLEDGE_DIR, "empty");
      mkdirSync(emptyDir);

      writeFileSync(
        CONFIG_PATH,
        `
datasets:
  - path: ${emptyDir}
    dataset_name: test-dataset
`,
      );

      mockListDocuments.mockResolvedValue([]);

      const results = await runSync({
        baseUrl: "http://localhost",
        apiKey: "test-key",
        configPath: CONFIG_PATH,
      });

      expect(results).toHaveLength(1);
      expect(results[0].created).toBe(0);
      expect(results[0].updated).toBe(0);
      expect(results[0].deleted).toBe(0);
      expect(results[0].skipped).toBe(0);
    });
  });
});
