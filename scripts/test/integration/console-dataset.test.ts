import { describe, expect, it } from "vitest";
import { getAuthWithPlaywright } from "../../src/auth/playwright-auth.js";
import { ConsoleClient } from "../../src/client/console.js";

const INTEGRATION_TEST = process.env.INTEGRATION_TEST === "true";
const DATASET_NAME = "test-dataset-integration";

describe.skipIf(!INTEGRATION_TEST)("ConsoleClient Dataset Operations", () => {
  const baseUrl = process.env.DIFY_CONSOLE_URL || "http://localhost";
  const email = process.env.DIFY_EMAIL;
  const password = process.env.DIFY_PASSWORD;

  it("should create, list, and delete a dataset", async () => {
    // 認証
    const auth = await getAuthWithPlaywright({
      baseUrl,
      email,
      password,
      headless: true,
    });

    const client = new ConsoleClient({ baseUrl, auth });

    // 既存のテストDatasetがあれば削除
    const existing = await client.getDatasetByName(DATASET_NAME);
    if (existing) {
      await client.deleteDataset(existing.id);
    }

    // Dataset作成
    const created = await client.createDataset({
      name: DATASET_NAME,
      description: "Integration test dataset",
      indexing_technique: "economy",
    });

    expect(created.name).toBe(DATASET_NAME);
    expect(created.id).toBeTruthy();

    // 作成確認
    const verified = await client.getDatasetByName(DATASET_NAME);
    expect(verified).not.toBeNull();
    expect(verified?.id).toBe(created.id);

    // Dataset一覧に含まれていることを確認
    const datasets = await client.getAllDatasets();
    const found = datasets.find((d) => d.id === created.id);
    expect(found).toBeTruthy();

    // 削除
    await client.deleteDataset(created.id);

    // 削除確認
    const afterDelete = await client.getDatasetByName(DATASET_NAME);
    expect(afterDelete).toBeNull();
  }, 60000); // タイムアウト60秒（Playwright認証に時間がかかる）
});
