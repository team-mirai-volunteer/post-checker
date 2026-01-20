import { DifyDocument } from "../models/difyDocument.js";
import { LocalDocument } from "../models/localDocument.js";

/**
 * 差分アクションの種類
 */
export type DiffAction = "create" | "update" | "delete" | "skip";

/**
 * 差分計算の結果
 */
export interface DiffResult {
  action: DiffAction;
  filename: string;
  localPath?: string; // create/update時
  documentId?: string; // update/delete時
  reason?: string; // "hash changed" など
}

/**
 * ドキュメント差分計算サービス
 * - LocalDocument と DifyDocument の比較
 * - 差分アクション（create / update / delete / skip）の決定
 */
export class DocumentDiffService {
  /**
   * ローカルドキュメントとDifyドキュメントの差分を計算
   */
  calculateDiff(localDocuments: LocalDocument[], difyDocuments: DifyDocument[]): DiffResult[] {
    const results: DiffResult[] = [];

    // ファイル名でDifyドキュメントをマップ
    const difyDocMap = new Map<string, DifyDocument>();
    for (const doc of difyDocuments) {
      difyDocMap.set(doc.name, doc);
    }

    // ローカルファイル名のセット
    const localFileNames = new Set(localDocuments.map((d) => d.filename));

    // ローカルドキュメントを処理
    for (const localDoc of localDocuments) {
      const difyDoc = difyDocMap.get(localDoc.filename);

      if (!difyDoc) {
        // Difyにない → CREATE
        results.push({
          action: "create",
          filename: localDoc.filename,
          localPath: localDoc.path,
        });
      } else {
        // 両方にある → ハッシュ比較
        if (localDoc.hashMatches(difyDoc.sourceHash)) {
          // ハッシュ一致 → SKIP
          results.push({
            action: "skip",
            filename: localDoc.filename,
            localPath: localDoc.path,
            documentId: difyDoc.id,
          });
        } else {
          // ハッシュ不一致または未設定 → UPDATE
          results.push({
            action: "update",
            filename: localDoc.filename,
            localPath: localDoc.path,
            documentId: difyDoc.id,
            reason: difyDoc.hasSourceHash() ? "hash changed" : "hash not set",
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
}

/**
 * 後方互換性のためのスタンドアロン関数
 * 旧 types.ts の LocalFile / DifyDocument 型を受け付ける
 */
export function calculateDiff(
  localFiles: Array<{ filename: string; path: string; content: string; hash: string }>,
  difyDocuments: Array<{
    id: string;
    name: string;
    doc_metadata?: { source_hash?: string };
    indexing_status?: string;
    error?: string | null;
  }>,
): DiffResult[] {
  // 旧型からドメインモデルに変換
  const localDocuments = localFiles.map((f) => LocalDocument.create(f.filename, f.path, f.content));

  const difyDocs = difyDocuments.map(
    (d) =>
      new DifyDocument(
        d.id,
        d.name,
        d.indexing_status ?? "completed",
        d.error ?? null,
        d.doc_metadata?.source_hash,
      ),
  );

  const service = new DocumentDiffService();
  return service.calculateDiff(localDocuments, difyDocs);
}

/**
 * 後方互換性のためのハッシュ計算関数
 */
export function computeHash(content: string): string {
  return LocalDocument.computeHash(content);
}
