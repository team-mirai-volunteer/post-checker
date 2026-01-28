/**
 * GitHub Contents API クライアント
 * リポジトリのファイル一覧取得と内容取得を行う
 */

const BASE_URL = "https://api.github.com";

export interface GitHubContentItem {
  name: string;
  path: string;
  sha: string;
  html_url: string;
  type: "file" | "dir";
  content?: string;
  encoding?: string;
}

export interface ListContentsOptions {
  owner: string;
  repo: string;
  path?: string;
  branch?: string;
}

export interface FetchFileOptions {
  owner: string;
  repo: string;
  path: string;
  branch?: string;
}

/**
 * リポジトリのディレクトリ内容を取得
 */
export async function listContents(options: ListContentsOptions): Promise<GitHubContentItem[]> {
  const { owner, repo, path = "", branch = "main" } = options;
  const url = `${BASE_URL}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "post-checker-manifesto-fetcher",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to list contents: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return Array.isArray(data) ? data : [data];
}

/**
 * 個別ファイルの内容を取得（Base64デコード済み）
 */
export async function fetchFileContent(options: FetchFileOptions): Promise<string> {
  const { owner, repo, path, branch = "main" } = options;
  const url = `${BASE_URL}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "post-checker-manifesto-fetcher",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch file content: ${res.status} ${res.statusText}`);
  }

  const data: GitHubContentItem = await res.json();

  if (!data.content || data.encoding !== "base64") {
    throw new Error(`Invalid file content: expected base64 encoded content`);
  }

  return Buffer.from(data.content, "base64").toString("utf-8");
}
