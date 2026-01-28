import { describe, expect, test } from "vitest";
import { shouldFetchFile } from "../../../src/application/fetchManifestoUsecase.js";
import type { GitHubContentItem } from "../../../src/infra/githubContentsClient.js";

function createMockItem(overrides: Partial<GitHubContentItem>): GitHubContentItem {
  return {
    name: "test.md",
    path: "test.md",
    sha: "abc123",
    html_url: "https://github.com/test/test/blob/main/test.md",
    type: "file",
    ...overrides,
  };
}

describe("shouldFetchFile", () => {
  test("markdownファイルは取得対象", () => {
    const item = createMockItem({ name: "01_ビジョン.md", type: "file" });
    expect(shouldFetchFile(item)).toBe(true);
  });

  test("README.mdは除外", () => {
    const item = createMockItem({ name: "README.md", type: "file" });
    expect(shouldFetchFile(item)).toBe(false);
  });

  test("readme.md（小文字）も除外", () => {
    const item = createMockItem({ name: "readme.md", type: "file" });
    expect(shouldFetchFile(item)).toBe(false);
  });

  test("ディレクトリは除外", () => {
    const item = createMockItem({ name: "docs", type: "dir" });
    expect(shouldFetchFile(item)).toBe(false);
  });

  test("非markdownファイルは除外", () => {
    const txtItem = createMockItem({ name: "config.txt", type: "file" });
    expect(shouldFetchFile(txtItem)).toBe(false);

    const jsonItem = createMockItem({ name: "package.json", type: "file" });
    expect(shouldFetchFile(jsonItem)).toBe(false);

    const yamlItem = createMockItem({ name: "index.yaml", type: "file" });
    expect(shouldFetchFile(yamlItem)).toBe(false);
  });

  test(".mdで終わるファイルのみ取得", () => {
    const item1 = createMockItem({ name: "policy.md", type: "file" });
    expect(shouldFetchFile(item1)).toBe(true);

    const item2 = createMockItem({ name: "policy.markdown", type: "file" });
    expect(shouldFetchFile(item2)).toBe(false);
  });
});
