// Dify Console API クライアント
// 認証情報（Cookie/CSRF）を使ってConsole APIを呼び出す

export interface ConsoleAuth {
  cookies: string;
  csrfToken: string;
}

export interface ConsoleApp {
  id: string;
  name: string;
  mode: string;
  icon: string;
  icon_background: string;
}

export interface ConsoleAppsResponse {
  data: ConsoleApp[];
  has_more: boolean;
  limit: number;
  page: number;
  total: number;
}

export interface ConsoleClientOptions {
  baseUrl: string;
  auth: ConsoleAuth;
  fetch?: typeof fetch;
}

export class ConsoleClient {
  private baseUrl: string;
  private auth: ConsoleAuth;
  private fetch: typeof fetch;

  constructor(options: ConsoleClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.auth = options.auth;
    this.fetch = options.fetch ?? globalThis.fetch;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Cookie: this.auth.cookies,
      "X-CSRF-Token": this.auth.csrfToken,
    };

    if (body) {
      headers["Content-Type"] = "application/json";
    }

    const response = await this.fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Console API error ${response.status}: ${text}`);
    }

    return response.json() as Promise<T>;
  }

  async listApps(page = 1, limit = 100): Promise<ConsoleAppsResponse> {
    return this.request<ConsoleAppsResponse>(
      "GET",
      `/console/api/apps?page=${page}&limit=${limit}`,
    );
  }

  async getAllApps(): Promise<ConsoleApp[]> {
    const apps: ConsoleApp[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.listApps(page);
      apps.push(...response.data);
      hasMore = response.has_more;
      page++;
    }

    return apps;
  }

  async exportDsl(appId: string, includeSecret = false): Promise<string> {
    const url = `${this.baseUrl}/console/api/apps/${appId}/export?include_secret=${includeSecret}`;
    const response = await this.fetch(url, {
      method: "GET",
      headers: {
        Cookie: this.auth.cookies,
        "X-CSRF-Token": this.auth.csrfToken,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Export DSL error ${response.status}: ${text}`);
    }

    // Dify API returns JSON with { data: "yaml string" }
    const json = (await response.json()) as { data: string };
    return json.data;
  }

  async importDsl(yamlContent: string): Promise<{ app_id: string }> {
    const url = `${this.baseUrl}/console/api/apps/import`;
    const formData = new FormData();
    formData.append("data", yamlContent);

    const response = await this.fetch(url, {
      method: "POST",
      headers: {
        Cookie: this.auth.cookies,
        "X-CSRF-Token": this.auth.csrfToken,
      },
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Import DSL error ${response.status}: ${text}`);
    }

    return response.json() as Promise<{ app_id: string }>;
  }

  async updateAppDsl(appId: string, yamlContent: string): Promise<void> {
    const url = `${this.baseUrl}/console/api/apps/${appId}/import`;
    const formData = new FormData();
    formData.append("data", yamlContent);

    const response = await this.fetch(url, {
      method: "POST",
      headers: {
        Cookie: this.auth.cookies,
        "X-CSRF-Token": this.auth.csrfToken,
      },
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Update App DSL error ${response.status}: ${text}`);
    }
  }

  async deleteApp(appId: string): Promise<void> {
    const url = `${this.baseUrl}/console/api/apps/${appId}`;
    const response = await this.fetch(url, {
      method: "DELETE",
      headers: {
        Cookie: this.auth.cookies,
        "X-CSRF-Token": this.auth.csrfToken,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Delete App error ${response.status}: ${text}`);
    }
  }
}
