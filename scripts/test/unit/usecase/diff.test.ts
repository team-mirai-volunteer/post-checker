import { describe, expect, it } from "vitest";
import type { DifyDocument, LocalFile } from "../../../src/types.js";
import { calculateDiff, computeHash } from "../../../src/usecase/diff.js";

function makeLocalFile(filename: string, content: string = "content"): LocalFile {
  return {
    filename,
    path: `/path/to/${filename}`,
    content,
    hash: computeHash(content),
  };
}

function makeDifyDoc(name: string, hash?: string): DifyDocument {
  return {
    id: `doc-${name}`,
    name,
    position: 1,
    data_source_type: "upload_file",
    data_source_info: null,
    dataset_process_rule_id: null,
    created_from: "api",
    created_by: "user",
    created_at: Date.now(),
    tokens: 0,
    indexing_status: "completed",
    error: null,
    enabled: true,
    disabled_at: null,
    disabled_by: null,
    archived: false,
    display_status: "available",
    word_count: 10,
    hit_count: 0,
    doc_form: "text_model",
    doc_metadata: hash ? { source_hash: hash } : undefined,
  };
}

describe("calculateDiff", () => {
  it("新規ファイル → CREATE", () => {
    const localFiles = [makeLocalFile("new.md")];
    const difyDocs: DifyDocument[] = [];

    const results = calculateDiff(localFiles, difyDocs);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      action: "create",
      filename: "new.md",
    });
  });

  it("Difyにのみ存在 → DELETE", () => {
    const localFiles: LocalFile[] = [];
    const difyDocs = [makeDifyDoc("old.md")];

    const results = calculateDiff(localFiles, difyDocs);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      action: "delete",
      filename: "old.md",
      documentId: "doc-old.md",
    });
  });

  it("ハッシュ一致 → SKIP", () => {
    const content = "same content";
    const hash = computeHash(content);
    const localFiles = [makeLocalFile("same.md", content)];
    const difyDocs = [makeDifyDoc("same.md", hash)];

    const results = calculateDiff(localFiles, difyDocs);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      action: "skip",
      filename: "same.md",
    });
  });

  it("ハッシュ不一致 → UPDATE", () => {
    const localFiles = [makeLocalFile("changed.md", "new content")];
    const difyDocs = [makeDifyDoc("changed.md", computeHash("old content"))];

    const results = calculateDiff(localFiles, difyDocs);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      action: "update",
      filename: "changed.md",
      reason: "hash changed",
    });
  });

  it("ハッシュ未設定 → UPDATE", () => {
    const localFiles = [makeLocalFile("no-hash.md")];
    const difyDocs = [makeDifyDoc("no-hash.md")]; // hash未設定

    const results = calculateDiff(localFiles, difyDocs);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      action: "update",
      filename: "no-hash.md",
      reason: "hash not set",
    });
  });

  it("複合ケース: CREATE/UPDATE/DELETE/SKIP混在", () => {
    const content = "unchanged";
    const hash = computeHash(content);

    const localFiles = [
      makeLocalFile("new.md", "new"),
      makeLocalFile("changed.md", "changed"),
      makeLocalFile("same.md", content),
    ];

    const difyDocs = [
      makeDifyDoc("changed.md", computeHash("original")),
      makeDifyDoc("same.md", hash),
      makeDifyDoc("deleted.md", "some-hash"),
    ];

    const results = calculateDiff(localFiles, difyDocs);

    expect(results).toHaveLength(4);

    const byAction = new Map(results.map((r) => [r.filename, r.action]));
    expect(byAction.get("new.md")).toBe("create");
    expect(byAction.get("changed.md")).toBe("update");
    expect(byAction.get("same.md")).toBe("skip");
    expect(byAction.get("deleted.md")).toBe("delete");
  });

  it("両方空 → 結果も空", () => {
    const results = calculateDiff([], []);
    expect(results).toHaveLength(0);
  });

  it("ローカル空、Dify有 → 全DELETE", () => {
    const difyDocs = [makeDifyDoc("a.md"), makeDifyDoc("b.md")];
    const results = calculateDiff([], difyDocs);

    expect(results).toHaveLength(2);
    expect(results.every((r) => r.action === "delete")).toBe(true);
  });

  it("ローカル有、Dify空 → 全CREATE", () => {
    const localFiles = [makeLocalFile("a.md"), makeLocalFile("b.md")];
    const results = calculateDiff(localFiles, []);

    expect(results).toHaveLength(2);
    expect(results.every((r) => r.action === "create")).toBe(true);
  });
});

describe("computeHash", () => {
  it("同じ内容は同じハッシュ", () => {
    expect(computeHash("hello")).toBe(computeHash("hello"));
  });

  it("異なる内容は異なるハッシュ", () => {
    expect(computeHash("hello")).not.toBe(computeHash("world"));
  });

  it("SHA-256形式 (64文字)", () => {
    expect(computeHash("test")).toMatch(/^[a-f0-9]{64}$/);
  });
});
