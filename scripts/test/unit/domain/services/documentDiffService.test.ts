import { describe, expect, it } from "vitest";
import { DifyDocument } from "../../../../src/domain/models/difyDocument.js";
import { LocalDocument } from "../../../../src/domain/models/localDocument.js";
import { DocumentDiffService } from "../../../../src/domain/services/documentDiffService.js";

function makeLocalDocument(filename: string, content: string = "content"): LocalDocument {
  return LocalDocument.create(filename, `/path/to/${filename}`, content);
}

function makeDifyDocument(name: string, hash?: string): DifyDocument {
  return new DifyDocument(`doc-${name}`, name, "completed", null, hash);
}

describe("DocumentDiffService", () => {
  const service = new DocumentDiffService();

  it("新規ファイル → CREATE", () => {
    const localDocuments = [makeLocalDocument("new.md")];
    const difyDocuments: DifyDocument[] = [];

    const results = service.calculateDiff(localDocuments, difyDocuments);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      action: "create",
      filename: "new.md",
    });
  });

  it("Difyにのみ存在 → DELETE", () => {
    const localDocuments: LocalDocument[] = [];
    const difyDocuments = [makeDifyDocument("old.md")];

    const results = service.calculateDiff(localDocuments, difyDocuments);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      action: "delete",
      filename: "old.md",
      documentId: "doc-old.md",
    });
  });

  it("ハッシュ一致 → SKIP", () => {
    const content = "same content";
    const hash = LocalDocument.computeHash(content);
    const localDocuments = [makeLocalDocument("same.md", content)];
    const difyDocuments = [makeDifyDocument("same.md", hash)];

    const results = service.calculateDiff(localDocuments, difyDocuments);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      action: "skip",
      filename: "same.md",
    });
  });

  it("ハッシュ不一致 → UPDATE", () => {
    const localDocuments = [makeLocalDocument("changed.md", "new content")];
    const difyDocuments = [
      makeDifyDocument("changed.md", LocalDocument.computeHash("old content")),
    ];

    const results = service.calculateDiff(localDocuments, difyDocuments);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      action: "update",
      filename: "changed.md",
      reason: "hash changed",
    });
  });

  it("ハッシュ未設定 → UPDATE", () => {
    const localDocuments = [makeLocalDocument("no-hash.md")];
    const difyDocuments = [makeDifyDocument("no-hash.md")]; // hash未設定

    const results = service.calculateDiff(localDocuments, difyDocuments);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      action: "update",
      filename: "no-hash.md",
      reason: "hash not set",
    });
  });

  it("複合ケース: CREATE/UPDATE/DELETE/SKIP混在", () => {
    const content = "unchanged";
    const hash = LocalDocument.computeHash(content);

    const localDocuments = [
      makeLocalDocument("new.md", "new"),
      makeLocalDocument("changed.md", "changed"),
      makeLocalDocument("same.md", content),
    ];

    const difyDocuments = [
      makeDifyDocument("changed.md", LocalDocument.computeHash("original")),
      makeDifyDocument("same.md", hash),
      makeDifyDocument("deleted.md", "some-hash"),
    ];

    const results = service.calculateDiff(localDocuments, difyDocuments);

    expect(results).toHaveLength(4);

    const byAction = new Map(results.map((r) => [r.filename, r.action]));
    expect(byAction.get("new.md")).toBe("create");
    expect(byAction.get("changed.md")).toBe("update");
    expect(byAction.get("same.md")).toBe("skip");
    expect(byAction.get("deleted.md")).toBe("delete");
  });

  it("両方空 → 結果も空", () => {
    const results = service.calculateDiff([], []);
    expect(results).toHaveLength(0);
  });

  it("ローカル空、Dify有 → 全DELETE", () => {
    const difyDocuments = [makeDifyDocument("a.md"), makeDifyDocument("b.md")];
    const results = service.calculateDiff([], difyDocuments);

    expect(results).toHaveLength(2);
    expect(results.every((r) => r.action === "delete")).toBe(true);
  });

  it("ローカル有、Dify空 → 全CREATE", () => {
    const localDocuments = [makeLocalDocument("a.md"), makeLocalDocument("b.md")];
    const results = service.calculateDiff(localDocuments, []);

    expect(results).toHaveLength(2);
    expect(results.every((r) => r.action === "create")).toBe(true);
  });
});

describe("LocalDocument.computeHash", () => {
  it("同じ内容は同じハッシュ", () => {
    expect(LocalDocument.computeHash("hello")).toBe(LocalDocument.computeHash("hello"));
  });

  it("異なる内容は異なるハッシュ", () => {
    expect(LocalDocument.computeHash("hello")).not.toBe(LocalDocument.computeHash("world"));
  });

  it("SHA-256形式 (64文字)", () => {
    expect(LocalDocument.computeHash("test")).toMatch(/^[a-f0-9]{64}$/);
  });
});
