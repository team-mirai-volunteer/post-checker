import { createHash } from "node:crypto";

/**
 * ローカルファイルのドメインモデル
 * - ファイル読み込み時にハッシュを自動計算
 * - ファイル名のバリデーション
 */
export class LocalDocument {
  readonly filename: string;
  readonly path: string;
  readonly content: string;
  readonly hash: string;

  private constructor(filename: string, path: string, content: string, hash: string) {
    this.filename = filename;
    this.path = path;
    this.content = content;
    this.hash = hash;
  }

  /**
   * コンテンツからLocalDocumentを生成
   * ハッシュは自動計算される
   */
  static create(filename: string, path: string, content: string): LocalDocument {
    if (!filename || filename.trim() === "") {
      throw new Error("Filename cannot be empty");
    }

    const hash = LocalDocument.computeHash(content);
    return new LocalDocument(filename, path, content, hash);
  }

  /**
   * SHA-256ハッシュを計算
   */
  static computeHash(content: string): string {
    return createHash("sha256").update(content, "utf8").digest("hex");
  }

  /**
   * ハッシュが一致するかどうか
   */
  hashMatches(otherHash: string | undefined): boolean {
    return otherHash !== undefined && this.hash === otherHash;
  }
}
