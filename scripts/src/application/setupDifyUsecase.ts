// Dify初期セットアップ usecase
import { chromium } from "playwright";

const SETUP_CONFIG = {
  baseUrl: "http://localhost",
  email: "user1@example.com",
  password: "user1@example.com",
  username: "user1",
} as const;

/**
 * Difyの初期セットアップを実行する
 * - /install にリダイレクトされた場合のみセットアップを実行
 * - 既にセットアップ済み（/apps, /signin）ならスキップ
 */
export async function setupDify(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Difyの起動を待機（最大30秒リトライ）
    await waitForDifyReady(page, SETUP_CONFIG.baseUrl);

    // リダイレクトが落ち着くまで待機（/apps → /install の連続リダイレクトに対応）
    await page.waitForLoadState("networkidle");

    // 現在のURLを確認
    const currentUrl = page.url();
    console.log(`Redirected to: ${currentUrl}`);

    if (currentUrl.includes("/install")) {
      console.log("Dify initial setup required. Running setup...");
      await performSetup(page);
      console.log("Dify setup completed!");
      console.log(`  Email: ${SETUP_CONFIG.email}`);
      console.log(`  Password: ${SETUP_CONFIG.password}`);
    } else if (currentUrl.includes("/apps") || currentUrl.includes("/signin")) {
      console.log("Dify is already set up. Skipping setup.");
    } else {
      console.log(`Unexpected redirect to: ${currentUrl}`);
    }
  } finally {
    await browser.close();
  }
}

/**
 * Difyが起動するまで待機
 */
async function waitForDifyReady(
  page: Awaited<ReturnType<typeof chromium.launch>>["newPage"] extends () => Promise<infer P>
    ? P
    : never,
  baseUrl: string,
  maxRetries = 15,
  retryInterval = 2000,
): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await page.goto(baseUrl, { timeout: 10000 });
      return; // 成功
    } catch {
      if (i < maxRetries - 1) {
        console.log(`Waiting for Dify to be ready... (${i + 1}/${maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, retryInterval));
      }
    }
  }
  throw new Error("Dify did not become ready within the timeout period");
}

/**
 * /install ページでセットアップを実行
 */
async function performSetup(
  page: Awaited<ReturnType<typeof chromium.launch>>["newPage"] extends () => Promise<infer P>
    ? P
    : never,
): Promise<void> {
  // フォームに入力
  await page.fill('input[name="email"], input#email, input[type="email"]', SETUP_CONFIG.email);
  await page.fill('input[name="name"], input#name', SETUP_CONFIG.username);
  await page.fill(
    'input[name="password"], input#password, input[type="password"]',
    SETUP_CONFIG.password,
  );

  // Submitボタンをクリック
  await page.click(
    'button[type="submit"], button:has-text("Setup"), button:has-text("セットアップ")',
  );

  // /apps への遷移を待機（セットアップ完了の判定）
  await page.waitForURL("**/apps**", { timeout: 60000 });
}
