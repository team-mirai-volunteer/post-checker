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
