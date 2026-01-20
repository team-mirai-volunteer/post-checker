import { spawn } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const CLI_PATH = path.resolve(__dirname, "../dify-cli.ts");

function runCli(
  args: string[],
  env: Record<string, string> = {},
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((resolve) => {
    const proc = spawn("tsx", [CLI_PATH, ...args], {
      env: { ...process.env, ...env },
      cwd: path.resolve(__dirname, "../.."),
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (exitCode) => {
      resolve({ stdout, stderr, exitCode });
    });
  });
}

describe("dify-cli", () => {
  describe("環境変数チェック", () => {
    it("DIFY_API_URL未設定でエラー終了", async () => {
      const result = await runCli(["sync"], {
        DIFY_API_URL: "",
        DIFY_API_KEY: "test-key",
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("DIFY_API_URL");
    });

    it("DIFY_API_KEY未設定でエラー終了", async () => {
      const result = await runCli(["sync"], {
        DIFY_API_URL: "http://localhost",
        DIFY_API_KEY: "",
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("DIFY_API_KEY");
    });
  });

  describe("コマンドパース", () => {
    it("引数なしでUsageを表示", async () => {
      const result = await runCli([]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Usage:");
      expect(result.stderr).toContain("sync");
    });

    it("不明なコマンドでUsageを表示", async () => {
      const result = await runCli(["unknown"]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Usage:");
    });

    it("listは未実装エラー", async () => {
      const result = await runCli(["list"]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("not implemented");
    });
  });
});
