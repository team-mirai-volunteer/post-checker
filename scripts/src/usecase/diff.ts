import { createHash } from "crypto";
import type { DiffResult, LocalFile, DifyDocument } from "../types.js";

export function computeHash(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export function calculateDiff(
  localFiles: LocalFile[],
  difyDocuments: DifyDocument[]
): DiffResult[] {
  const results: DiffResult[] = [];

  // ファイル名でDifyドキュメントをマップ
  const difyDocMap = new Map<string, DifyDocument>();
  for (const doc of difyDocuments) {
    difyDocMap.set(doc.name, doc);
  }

  // ローカルファイル名のセット
  const localFileNames = new Set(localFiles.map((f) => f.filename));

  // ローカルファイルを処理
  for (const localFile of localFiles) {
    const difyDoc = difyDocMap.get(localFile.filename);

    if (!difyDoc) {
      // Difyにない → CREATE
      results.push({
        action: "create",
        filename: localFile.filename,
        localPath: localFile.path,
      });
    } else {
      // 両方にある → ハッシュ比較
      const difyHash = difyDoc.doc_metadata?.source_hash;
      if (difyHash && difyHash === localFile.hash) {
        // ハッシュ一致 → SKIP
        results.push({
          action: "skip",
          filename: localFile.filename,
          localPath: localFile.path,
          documentId: difyDoc.id,
        });
      } else {
        // ハッシュ不一致または未設定 → UPDATE
        results.push({
          action: "update",
          filename: localFile.filename,
          localPath: localFile.path,
          documentId: difyDoc.id,
          reason: difyHash ? "hash changed" : "hash not set",
        });
      }
    }
  }

  // Difyにあってローカルにないドキュメント → DELETE
  for (const difyDoc of difyDocuments) {
    if (!localFileNames.has(difyDoc.name)) {
      results.push({
        action: "delete",
        filename: difyDoc.name,
        documentId: difyDoc.id,
      });
    }
  }

  return results;
}
