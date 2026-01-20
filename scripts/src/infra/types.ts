// Dify API レスポンス型とクライアントオプション型

import type { DifyDocumentApiResponse } from "../domain/models/difyDocument.js";

/**
 * Dify ドキュメントリストAPIレスポンス
 */
export interface DifyDocumentListResponse {
  data: DifyDocumentApiResponse[];
  has_more: boolean;
  limit: number;
  total: number;
  page: number;
}

/**
 * Dify ドキュメント作成APIレスポンス
 */
export interface DifyCreateDocumentResponse {
  document: DifyDocumentApiResponse;
  batch: string;
}

/**
 * Dify ドキュメント更新APIレスポンス
 */
export interface DifyUpdateDocumentResponse {
  document: DifyDocumentApiResponse;
  batch: string;
}

/**
 * Knowledge API クライアントオプション
 */
export interface KnowledgeClientOptions {
  baseUrl: string;
  apiKey: string;
  fetch?: typeof fetch;
}

/**
 * ドキュメント作成オプション
 */
export interface CreateDocumentOptions {
  indexing_technique?: "high_quality" | "economy";
  process_rule?: { mode: "automatic" | "custom" };
}

/**
 * Dify Dataset API レスポンス（単一データセット）
 */
export interface DifyDatasetApiResponse {
  id: string;
  name: string;
  description: string;
  permission: string;
  data_source_type: string;
  indexing_technique: string;
  app_count: number;
  document_count: number;
  word_count: number;
  created_by: string;
  created_at: number;
  updated_by: string;
  updated_at: number;
}

/**
 * Dify Dataset一覧 API レスポンス
 */
export interface DifyDatasetListResponse {
  data: DifyDatasetApiResponse[];
  has_more: boolean;
  limit: number;
  total: number;
  page: number;
}
