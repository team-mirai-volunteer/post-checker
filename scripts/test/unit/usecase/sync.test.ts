import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runSync } from "../../../src/usecase/sync.js";

const TEST_DIR = "/tmp/dify-sync-test";
const CONFIG_PATH = join(TEST_DIR, "sync.yaml");
const KNOWLEDGE_DIR = join(TEST_DIR, "knowledges");

describe("runSync unit", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(KNOWLEDGE_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

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
    dataset_id: test-dataset
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

const INTEGRATION_TEST = process.env.INTEGRATION_TEST === "true";
const DIFY_API_URL = process.env.DIFY_API_URL || "http://localhost";
const DIFY_API_KEY = process.env.DIFY_API_KEY || "";
const DIFY_TEST_DATASET_ID = process.env.DIFY_TEST_DATASET_ID || "";

describe.skipIf(!INTEGRATION_TEST)("runSync integration", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(KNOWLEDGE_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  it("空のディレクトリの場合は何もしない", async () => {
    const emptyDir = join(KNOWLEDGE_DIR, "empty");
    mkdirSync(emptyDir);

    writeFileSync(
      CONFIG_PATH,
      `
datasets:
  - path: ${emptyDir}
    dataset_id: ${DIFY_TEST_DATASET_ID}
`,
    );

    const results = await runSync({
      baseUrl: DIFY_API_URL,
      apiKey: DIFY_API_KEY,
      configPath: CONFIG_PATH,
    });

    expect(results).toHaveLength(1);
    expect(results[0].created).toBe(0);
  });

  it("新規ファイルをCREATEできる", { timeout: 60000 }, async () => {
    const testDir = join(KNOWLEDGE_DIR, "test");
    mkdirSync(testDir);
    writeFileSync(join(testDir, "test.md"), "# Test\n\nテスト内容");

    writeFileSync(
      CONFIG_PATH,
      `
datasets:
  - path: ${testDir}
    dataset_id: ${DIFY_TEST_DATASET_ID}
`,
    );

    const logs: string[] = [];
    const results = await runSync({
      baseUrl: DIFY_API_URL,
      apiKey: DIFY_API_KEY,
      configPath: CONFIG_PATH,
      onProgress: (msg) => logs.push(msg),
    });

    expect(results).toHaveLength(1);
    expect(results[0].created).toBe(1);
    expect(logs.some((l) => l.includes("CREATE"))).toBe(true);
  });
});
