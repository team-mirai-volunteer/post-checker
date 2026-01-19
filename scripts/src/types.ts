// 設定ファイルの型
export interface SyncConfig {
  datasets: DatasetConfig[];
}

export interface DatasetConfig {
  path: string;
  dataset_id: string;
  indexing_technique?: "high_quality" | "economy";
  process_rule?: { mode: "automatic" | "custom" };
}

// 差分計算の結果
export type DiffAction = "create" | "update" | "delete" | "skip";

export interface DiffResult {
  action: DiffAction;
  filename: string;
  localPath?: string; // create/update時
  documentId?: string; // update/delete時
  reason?: string; // "hash changed" など
}

// ローカルファイル情報
export interface LocalFile {
  filename: string;
  path: string;
  content: string;
  hash: string;
}

// Dify API レスポンス
export interface DifyDocument {
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

export interface DifyDocumentListResponse {
  data: DifyDocument[];
  has_more: boolean;
  limit: number;
  total: number;
  page: number;
}

export interface DifyCreateDocumentResponse {
  document: DifyDocument;
  batch: string;
}

export interface DifyUpdateDocumentResponse {
  document: DifyDocument;
  batch: string;
}

// 同期結果
export interface SyncResult {
  datasetId: string;
  path: string;
  created: number;
  updated: number;
  deleted: number;
  skipped: number;
  errors: SyncError[];
}

export interface SyncError {
  filename: string;
  action: DiffAction;
  error: string;
}

// Client options
export interface KnowledgeClientOptions {
  baseUrl: string;
  apiKey: string;
  fetch?: typeof fetch;
}

export interface CreateDocumentOptions {
  indexing_technique?: "high_quality" | "economy";
  process_rule?: { mode: "automatic" | "custom" };
}
