// 設定ファイルの型とDTO

/**
 * 同期設定ファイルの型
 */
export interface SyncConfig {
  datasets: DatasetConfig[];
}

/**
 * データセット設定
 */
export interface DatasetConfig {
  path: string;
  dataset_name: string;
  indexing_technique?: "high_quality" | "economy";
  process_rule?: { mode: "automatic" | "custom" };
}
