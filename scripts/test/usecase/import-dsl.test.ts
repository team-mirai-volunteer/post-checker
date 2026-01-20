import * as fs from "node:fs/promises";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetAllApps, mockImportDsl, mockUpdateAppDsl } = vi.hoisted(() => ({
  mockGetAllApps: vi.fn(),
  mockImportDsl: vi.fn(),
  mockUpdateAppDsl: vi.fn(),
}));

vi.mock("../../src/auth/playwright-auth.js", () => ({
  getAuthWithPlaywright: vi.fn().mockResolvedValue({
    cookies: "test-cookie",
    csrfToken: "test-csrf",
  }),
}));

vi.mock("../../src/client/console.js", () => {
  return {
    ConsoleClient: class {
      getAllApps = mockGetAllApps;
      importDsl = mockImportDsl;
      updateAppDsl = mockUpdateAppDsl;
    },
  };
});

import { importAllDsl } from "../../src/usecase/import-dsl.js";

const TEST_DIR = "/tmp/test-import-dsl";

describe("importAllDsl", () => {
  beforeEach(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
    vi.clearAllMocks();
    mockGetAllApps.mockResolvedValue([]);
    mockImportDsl.mockResolvedValue({ app_id: "new-app-id" });
    mockUpdateAppDsl.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  it("入力ディレクトリが存在しない場合はエラー", async () => {
    await expect(
      importAllDsl({
        baseUrl: "http://localhost",
        inputDir: "/nonexistent/path",
        dryRun: true,
      }),
    ).rejects.toThrow("Input directory does not exist");
  });

  it("DSLファイルがない場合は空の結果を返す", async () => {
    const results = await importAllDsl({
      baseUrl: "http://localhost",
      inputDir: TEST_DIR,
      dryRun: true,
    });

    expect(results).toHaveLength(0);
  });

  it("dry-run: 新規アプリはcreatedとして報告", async () => {
    const dslContent = `app:
  name: test-app
  mode: workflow
`;
    await fs.writeFile(path.join(TEST_DIR, "test-app.yml"), dslContent);

    const results = await importAllDsl({
      baseUrl: "http://localhost",
      inputDir: TEST_DIR,
      dryRun: true,
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      filename: "test-app.yml",
      appName: "test-app",
      status: "created",
    });
  });

  it("既存アプリはskippedとして報告（forceなし）", async () => {
    mockGetAllApps.mockResolvedValue([{ id: "app-123", name: "existing-app", mode: "workflow" }]);

    const dslContent = `app:
  name: existing-app
  mode: workflow
`;
    await fs.writeFile(path.join(TEST_DIR, "existing-app.yml"), dslContent);

    const results = await importAllDsl({
      baseUrl: "http://localhost",
      inputDir: TEST_DIR,
      dryRun: false,
      force: false,
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      filename: "existing-app.yml",
      appName: "existing-app",
      status: "skipped",
    });
  });

  it("既存アプリはupdatedとして報告（forceあり）", async () => {
    mockGetAllApps.mockResolvedValue([{ id: "app-123", name: "existing-app", mode: "workflow" }]);

    const dslContent = `app:
  name: existing-app
  mode: workflow
`;
    await fs.writeFile(path.join(TEST_DIR, "existing-app.yml"), dslContent);

    const results = await importAllDsl({
      baseUrl: "http://localhost",
      inputDir: TEST_DIR,
      dryRun: false,
      force: true,
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      filename: "existing-app.yml",
      appName: "existing-app",
      appId: "app-123",
      status: "updated",
    });
    expect(mockUpdateAppDsl).toHaveBeenCalledWith("app-123", dslContent);
  });

  it("新規アプリはcreatedとして報告（実行時）", async () => {
    const dslContent = `app:
  name: new-app
  mode: workflow
`;
    await fs.writeFile(path.join(TEST_DIR, "new-app.yml"), dslContent);

    const results = await importAllDsl({
      baseUrl: "http://localhost",
      inputDir: TEST_DIR,
      dryRun: false,
      force: false,
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      filename: "new-app.yml",
      appName: "new-app",
      appId: "new-app-id",
      status: "created",
    });
    expect(mockImportDsl).toHaveBeenCalledWith(dslContent);
  });

  it("YAMLパースエラーはfailedとして報告", async () => {
    await fs.writeFile(path.join(TEST_DIR, "invalid.yml"), "invalid: yaml: content:");

    const results = await importAllDsl({
      baseUrl: "http://localhost",
      inputDir: TEST_DIR,
      dryRun: true,
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      filename: "invalid.yml",
      status: "failed",
    });
  });

  it("app.nameがないYAMLはfailedとして報告", async () => {
    const dslContent = `workflow:
  nodes: []
`;
    await fs.writeFile(path.join(TEST_DIR, "no-name.yml"), dslContent);

    const results = await importAllDsl({
      baseUrl: "http://localhost",
      inputDir: TEST_DIR,
      dryRun: true,
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      filename: "no-name.yml",
      status: "failed",
      error: "Failed to extract app name from YAML",
    });
  });

  it(".ymlと.yamlの両方を処理する", async () => {
    const dslContent1 = `app:
  name: app1
  mode: workflow
`;
    const dslContent2 = `app:
  name: app2
  mode: workflow
`;
    await fs.writeFile(path.join(TEST_DIR, "app1.yml"), dslContent1);
    await fs.writeFile(path.join(TEST_DIR, "app2.yaml"), dslContent2);

    const results = await importAllDsl({
      baseUrl: "http://localhost",
      inputDir: TEST_DIR,
      dryRun: true,
    });

    expect(results).toHaveLength(2);
    const filenames = results.map((r) => r.filename);
    expect(filenames).toContain("app1.yml");
    expect(filenames).toContain("app2.yaml");
  });
});
