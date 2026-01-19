// Playwrightを使ってDify Console認証情報を取得する
import { chromium, type BrowserContext } from "playwright";
import type { ConsoleAuth } from "../client/console.js";

const AUTH_STATE_PATH = ".dify-auth-state.json";

export interface AuthOptions {
  baseUrl: string;
  email?: string;
  password?: string;
  headless?: boolean;
}

/**
 * Playwrightでログインし、Cookie/CSRFトークンを取得する
 * - 保存済みのセッションがあれば再利用
 * - なければブラウザを開いて手動ログインを待つ
 */
export async function getAuthWithPlaywright(
  options: AuthOptions
): Promise<ConsoleAuth> {
  const { baseUrl, email, password, headless = false } = options;

  const browser = await chromium.launch({ headless });

  // 保存済みのセッションを試す
  let context: BrowserContext;
  try {
    context = await browser.newContext({ storageState: AUTH_STATE_PATH });
    const auth = await extractAuth(context, baseUrl);
    if (auth) {
      console.log("Using saved session.");
      await browser.close();
      return auth;
    }
  } catch {
    // 保存済みセッションなし、または無効
  }

  // 新規ログイン
  context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${baseUrl}/signin`);

  if (email && password) {
    // 自動ログイン
    console.log("Logging in automatically...");
    await page.fill("#email", email);
    await page.fill("#password", password);
    // Difyのログインボタンはtype="submit"ではなくonClickで動作する
    await page.click('button:has-text("Sign in"), button:has-text("ログイン")');
  } else {
    // 手動ログイン
    console.log("Opening Dify login page...");
    console.log("Please log in manually. Waiting for authentication...\n");
  }

  // ダッシュボードに遷移するまで待つ（ログイン完了の判定）
  await page.waitForURL("**/apps**", { timeout: 300000 }); // 5分待つ

  console.log("Login successful!");

  // セッションを保存
  await context.storageState({ path: AUTH_STATE_PATH });

  const auth = await extractAuth(context, baseUrl);
  await browser.close();

  if (!auth) {
    throw new Error("Failed to extract auth after login");
  }

  return auth;
}

async function extractAuth(
  context: BrowserContext,
  baseUrl: string
): Promise<ConsoleAuth | null> {
  const cookies = await context.cookies(baseUrl);

  const csrfCookie = cookies.find((c) => c.name === "csrf_token");
  if (!csrfCookie) {
    return null;
  }

  // access_tokenまたはセッションCookieがあるか確認
  const hasSession = cookies.some(
    (c) =>
      c.name === "access_token" ||
      c.name === "session" ||
      c.name === "remember_token"
  );

  if (!hasSession) {
    // HttpOnly Cookieはcontext.cookies()では取得できない場合がある
    // その場合でもCookieヘッダーとして送れば動く可能性がある
  }

  const cookieString = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

  return {
    cookies: cookieString,
    csrfToken: csrfCookie.value,
  };
}

/**
 * 保存済みセッションをクリアする
 */
export async function clearAuthState(): Promise<void> {
  const fs = await import("fs/promises");
  try {
    await fs.unlink(AUTH_STATE_PATH);
    console.log("Auth state cleared.");
  } catch {
    // ファイルが存在しない場合は無視
  }
}
