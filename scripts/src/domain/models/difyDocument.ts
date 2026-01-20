/**
 * Difyドキュメントのドメインモデル
 * - Dify APIレスポンスからの変換
 * - インデックス状態の判定ロジック
 */
export class DifyDocument {
  readonly id: string;
  readonly name: string;
  readonly indexingStatus: string;
  readonly error: string | null;
  readonly sourceHash: string | undefined;

  constructor(
    id: string,
    name: string,
    indexingStatus: string,
    error: string | null,
    sourceHash: string | undefined,
  ) {
    this.id = id;
    this.name = name;
    this.indexingStatus = indexingStatus;
    this.error = error;
    this.sourceHash = sourceHash;
  }

  /**
   * Dify APIレスポンスからDifyDocumentを生成
   */
  static fromApiResponse(response: DifyDocumentApiResponse): DifyDocument {
    return new DifyDocument(
      response.id,
      response.name,
      response.indexing_status,
      response.error,
      response.doc_metadata?.source_hash,
    );
  }

  /**
   * インデックスが完了しているかどうか
   */
  isIndexingCompleted(): boolean {
    return this.indexingStatus === "completed";
  }

  /**
   * インデックスがエラーかどうか
   */
  isIndexingError(): boolean {
    return this.indexingStatus === "error";
  }

  /**
   * インデックスが進行中かどうか
   */
  isIndexingPending(): boolean {
    return !this.isIndexingCompleted() && !this.isIndexingError();
  }

  /**
   * ソースハッシュが設定されているかどうか
   */
  hasSourceHash(): boolean {
    return this.sourceHash !== undefined;
  }
}

/**
 * Dify APIレスポンスの型（infra層から参照される）
 */
export interface DifyDocumentApiResponse {
  id: string;
  name: string;
  position: number;
  data_source_type: string;
  data_source_info: {
    upload_file_id?: string;
  } | null;
  dataset_process_rule_id: string | null;
  created_from: string;
  created_by: string;
  created_at: number;
  tokens: number;
  indexing_status: string;
  error: string | null;
  enabled: boolean;
  disabled_at: number | null;
  disabled_by: string | null;
  archived: boolean;
  display_status: string;
  word_count: number;
  hit_count: number;
  doc_form: string;
  doc_metadata?: {
    source_hash?: string;
    synced_at?: string;
  };
}
