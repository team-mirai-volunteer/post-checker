import type { DiffAction } from "../services/documentDiffService.js";

/**
 * 同期エラー
 */
export interface SyncErrorInfo {
  filename: string;
  action: DiffAction;
  error: string;
}

/**
 * 同期結果のドメインモデル
 * - 同期結果の集計ロジック
 * - エラー追加メソッド
 */
export class SyncResult {
  readonly datasetId: string;
  readonly datasetName: string;
  readonly path: string;
  private _created: number;
  private _updated: number;
  private _deleted: number;
  private _skipped: number;
  private _errors: SyncErrorInfo[];

  constructor(datasetId: string, datasetName: string, path: string) {
    this.datasetId = datasetId;
    this.datasetName = datasetName;
    this.path = path;
    this._created = 0;
    this._updated = 0;
    this._deleted = 0;
    this._skipped = 0;
    this._errors = [];
  }

  get created(): number {
    return this._created;
  }

  get updated(): number {
    return this._updated;
  }

  get deleted(): number {
    return this._deleted;
  }

  get skipped(): number {
    return this._skipped;
  }

  get errors(): ReadonlyArray<SyncErrorInfo> {
    return this._errors;
  }

  /**
   * 作成数をインクリメント
   */
  incrementCreated(): void {
    this._created++;
  }

  /**
   * 更新数をインクリメント
   */
  incrementUpdated(): void {
    this._updated++;
  }

  /**
   * 削除数をインクリメント
   */
  incrementDeleted(): void {
    this._deleted++;
  }

  /**
   * スキップ数をインクリメント
   */
  incrementSkipped(): void {
    this._skipped++;
  }

  /**
   * エラーを追加
   */
  addError(filename: string, action: DiffAction, error: string): void {
    this._errors.push({ filename, action, error });
  }

  /**
   * 合計処理数
   */
  get totalProcessed(): number {
    return this._created + this._updated + this._deleted + this._skipped;
  }

  /**
   * エラーがあるかどうか
   */
  hasErrors(): boolean {
    return this._errors.length > 0;
  }

  /**
   * プレーンオブジェクトに変換（後方互換性のため）
   */
  toPlainObject(): {
    datasetId: string;
    datasetName: string;
    path: string;
    created: number;
    updated: number;
    deleted: number;
    skipped: number;
    errors: SyncErrorInfo[];
  } {
    return {
      datasetId: this.datasetId,
      datasetName: this.datasetName,
      path: this.path,
      created: this._created,
      updated: this._updated,
      deleted: this._deleted,
      skipped: this._skipped,
      errors: [...this._errors],
    };
  }
}
