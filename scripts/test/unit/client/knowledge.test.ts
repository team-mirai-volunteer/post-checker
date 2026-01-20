import { afterEach, describe, expect, it, vi } from "vitest";
import { KnowledgeClient, KnowledgeClientError } from "../../../src/client/knowledge.js";

// Unit tests (with mocked fetch)
describe("KnowledgeClient unit", () => {
  it("listDocuments - 正常系", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: [{ id: "doc-1", name: "test.md" }],
          has_more: false,
          total: 1,
          page: 1,
        }),
    });

    const client = new KnowledgeClient({
      baseUrl: "http://localhost",
      apiKey: "test-key",
      fetch: mockFetch as typeof fetch,
    });

    const docs = await client.listDocuments("dataset-123");

    expect(docs).toHaveLength(1);
    expect(docs[0].name).toBe("test.md");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost/v1/datasets/dataset-123/documents?page=1&limit=100",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-key",
        }),
      }),
    );
  });

  it("listDocuments - ページネーション", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            data: [{ id: "doc-1", name: "a.md" }],
            has_more: true,
            total: 2,
            page: 1,
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            data: [{ id: "doc-2", name: "b.md" }],
            has_more: false,
            total: 2,
            page: 2,
          }),
      });

    const client = new KnowledgeClient({
      baseUrl: "http://localhost",
      apiKey: "test-key",
      fetch: mockFetch as typeof fetch,
    });

    const docs = await client.listDocuments("dataset-123");

    expect(docs).toHaveLength(2);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("createDocument - 正常系", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          document: { id: "new-doc", name: "test.md" },
          batch: "batch-123",
        }),
    });

    const client = new KnowledgeClient({
      baseUrl: "http://localhost",
      apiKey: "test-key",
      fetch: mockFetch as typeof fetch,
    });

    const doc = await client.createDocument("dataset-123", "test.md", "content");

    expect(doc.id).toBe("new-doc");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost/v1/datasets/dataset-123/document/create_by_text",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("test.md"),
      }),
    );
  });

  it("401エラー - 認証エラー", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: () => Promise.resolve('{"message":"Invalid API key"}'),
    });

    const client = new KnowledgeClient({
      baseUrl: "http://localhost",
      apiKey: "invalid-key",
      fetch: mockFetch as typeof fetch,
    });

    await expect(client.listDocuments("dataset-123")).rejects.toThrow(KnowledgeClientError);
  });

  it("deleteDocument - 正常系", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ result: "success" }),
    });

    const client = new KnowledgeClient({
      baseUrl: "http://localhost",
      apiKey: "test-key",
      fetch: mockFetch as typeof fetch,
    });

    await client.deleteDocument("dataset-123", "doc-456");

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost/v1/datasets/dataset-123/documents/doc-456",
      expect.objectContaining({
        method: "DELETE",
      }),
    );
  });
});

// Integration tests (with real Dify API)
const INTEGRATION_TEST = process.env.INTEGRATION_TEST === "true";
const DIFY_API_URL = process.env.DIFY_API_URL || "http://localhost";
const DIFY_API_KEY = process.env.DIFY_API_KEY || "";
const DIFY_TEST_DATASET_ID = process.env.DIFY_TEST_DATASET_ID || "";

describe.skipIf(!INTEGRATION_TEST)("KnowledgeClient integration", () => {
  const client = new KnowledgeClient({
    baseUrl: DIFY_API_URL,
    apiKey: DIFY_API_KEY,
  });

  const createdDocIds: string[] = [];

  async function waitForIndexing(docId: string, timeout = 30000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const docs = await client.listDocuments(DIFY_TEST_DATASET_ID);
      const doc = docs.find((d) => d.id === docId);
      if (doc?.indexing_status === "completed") {
        return;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error(`Timeout waiting for document ${docId} to be indexed`);
  }

  afterEach(async () => {
    for (const id of createdDocIds) {
      try {
        await client.deleteDocument(DIFY_TEST_DATASET_ID, id);
      } catch {
        // ignore cleanup errors
      }
    }
    createdDocIds.length = 0;
  });

  it("listDocuments - ドキュメント一覧を取得できる", async () => {
    const docs = await client.listDocuments(DIFY_TEST_DATASET_ID);
    expect(Array.isArray(docs)).toBe(true);
  });

  it("createDocument - ドキュメントを作成できる", async () => {
    const name = `test-${Date.now()}.md`;
    const doc = await client.createDocument(DIFY_TEST_DATASET_ID, name, "テスト内容です");

    createdDocIds.push(doc.id);

    expect(doc.id).toBeDefined();
    expect(doc.name).toBe(name);
  });

  it("create → list → delete の一連のフロー", async () => {
    const name = `test-flow-${Date.now()}.md`;

    const doc = await client.createDocument(DIFY_TEST_DATASET_ID, name, "フローテスト");
    createdDocIds.push(doc.id);

    const listAfterCreate = await client.listDocuments(DIFY_TEST_DATASET_ID);
    expect(listAfterCreate.some((d) => d.id === doc.id)).toBe(true);

    await client.deleteDocument(DIFY_TEST_DATASET_ID, doc.id);
    createdDocIds.splice(createdDocIds.indexOf(doc.id), 1);

    const listAfterDelete = await client.listDocuments(DIFY_TEST_DATASET_ID);
    expect(listAfterDelete.some((d) => d.id === doc.id)).toBe(false);
  });

  it("updateDocument - ドキュメントを更新できる", { timeout: 60000 }, async () => {
    const name = `test-update-${Date.now()}.md`;

    const doc = await client.createDocument(DIFY_TEST_DATASET_ID, name, "更新前");
    createdDocIds.push(doc.id);

    await waitForIndexing(doc.id);

    const updated = await client.updateDocument(DIFY_TEST_DATASET_ID, doc.id, name, "更新後");
    expect(updated.id).toBe(doc.id);
  });
});
