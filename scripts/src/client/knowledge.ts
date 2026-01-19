import type {
  DifyDocument,
  DifyDocumentListResponse,
  DifyCreateDocumentResponse,
  DifyUpdateDocumentResponse,
  KnowledgeClientOptions,
  CreateDocumentOptions,
} from "../types.js";

export class KnowledgeClientError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public responseBody?: unknown
  ) {
    super(message);
    this.name = "KnowledgeClientError";
  }
}

export class KnowledgeClient {
  private baseUrl: string;
  private apiKey: string;
  private fetchFn: typeof fetch;
  private maxRetries = 3;
  private retryDelay = 1000;

  constructor(options: KnowledgeClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this.fetchFn = options.fetch ?? fetch;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await this.fetchFn(url, {
          ...options,
          headers,
        });

        if (!response.ok) {
          const body = await response.text();
          let parsedBody: unknown;
          try {
            parsedBody = JSON.parse(body);
          } catch {
            parsedBody = body;
          }

          const error = new KnowledgeClientError(
            `API error: ${response.status} ${response.statusText}`,
            response.status,
            parsedBody
          );

          // 5xx errors are retryable
          if (response.status >= 500 && attempt < this.maxRetries - 1) {
            lastError = error;
            await this.sleep(this.retryDelay * (attempt + 1));
            continue;
          }

          throw error;
        }

        // DELETE returns empty response
        if (response.status === 204 || options.method === "DELETE") {
          return undefined as T;
        }

        return (await response.json()) as T;
      } catch (error) {
        if (error instanceof KnowledgeClientError) {
          throw error;
        }
        // Network errors are retryable
        if (attempt < this.maxRetries - 1) {
          lastError = error as Error;
          await this.sleep(this.retryDelay * (attempt + 1));
          continue;
        }
        throw error;
      }
    }

    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async listDocuments(
    datasetId: string,
    options: { page?: number; limit?: number } = {}
  ): Promise<DifyDocument[]> {
    const { page = 1, limit = 100 } = options;
    const allDocuments: DifyDocument[] = [];
    let currentPage = page;
    let hasMore = true;

    while (hasMore) {
      const response = await this.request<DifyDocumentListResponse>(
        `/v1/datasets/${datasetId}/documents?page=${currentPage}&limit=${limit}`
      );

      allDocuments.push(...response.data);
      hasMore = response.has_more;
      currentPage++;
    }

    return allDocuments;
  }

  async createDocument(
    datasetId: string,
    name: string,
    text: string,
    options: CreateDocumentOptions = {}
  ): Promise<DifyDocument> {
    const body = {
      name,
      text,
      indexing_technique: options.indexing_technique ?? "high_quality",
      process_rule: options.process_rule ?? { mode: "automatic" },
    };

    const response = await this.request<DifyCreateDocumentResponse>(
      `/v1/datasets/${datasetId}/document/create_by_text`,
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    );

    return response.document;
  }

  async updateDocument(
    datasetId: string,
    documentId: string,
    name: string,
    text: string
  ): Promise<DifyDocument> {
    const body = {
      name,
      text,
    };

    const response = await this.request<DifyUpdateDocumentResponse>(
      `/v1/datasets/${datasetId}/documents/${documentId}/update_by_text`,
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    );

    return response.document;
  }

  async deleteDocument(datasetId: string, documentId: string): Promise<void> {
    await this.request<void>(
      `/v1/datasets/${datasetId}/documents/${documentId}`,
      {
        method: "DELETE",
      }
    );
  }
}
