import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stringify as yamlStringify } from "yaml";
import { fetchArticleDetail, fetchArticleList, type NoteApiArticle } from "../infra/noteClient.js";

export interface NoteArticleMeta {
  key: string;
  title: string;
  url: string;
  publishedAt: string;
  filename: string;
}

export async function fetchNoteArticles(options: {
  username: string;
  outputDir: string;
  limit?: number;
  dryRun: boolean;
  onProgress?: (msg: string) => void;
}): Promise<{ savedCount: number; errorCount: number }> {
  const { username, outputDir, limit, dryRun, onProgress: log = () => {} } = options;
  let savedCount = 0,
    errorCount = 0;
  const articlesMeta: NoteArticleMeta[] = [];

  const list = await fetchArticleList(username, limit);
  log(`Found ${list.length} articles`);

  for (let i = 0; i < list.length; i++) {
    log(`  [${i + 1}/${list.length}] ${list[i].name}`);
    try {
      const article = await fetchArticleDetail(list[i].key);
      const filename = generateFilename(article);
      const content = generateMarkdown(article);

      if (dryRun) {
        log(`    -> Would save: ${filename}`);
      } else {
        if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
        writeFileSync(join(outputDir, filename), content, "utf-8");
        log(`    -> Saved: ${filename}`);
      }

      articlesMeta.push(generateMeta(article, filename));
      savedCount++;
      if (i < list.length - 1) await new Promise((r) => setTimeout(r, 1000));
    } catch (e) {
      log(`    -> Error: ${e instanceof Error ? e.message : e}`);
      errorCount++;
    }
  }

  // index.yaml を出力
  if (!dryRun && articlesMeta.length > 0) {
    const indexPath = join(outputDir, "index.yaml");
    writeFileSync(indexPath, yamlStringify({ articles: articlesMeta }), "utf-8");
    log(`  -> Index: ${indexPath}`);
  }

  return { savedCount, errorCount };
}

export function generateFilename(a: NoteApiArticle): string {
  const d = new Date(a.publish_at);
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const title = a.name
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 50);
  return `${date}_${a.key}_${title}.md`;
}

export function generateMeta(a: NoteApiArticle, filename: string): NoteArticleMeta {
  const d = new Date(a.publish_at);
  const publishedAt = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return {
    key: a.key,
    title: a.name,
    url: `https://note.com/${a.user.urlname}/n/${a.key}`,
    publishedAt,
    filename,
  };
}

export function generateMarkdown(a: NoteApiArticle): string {
  const d = new Date(a.publish_at);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const tags = a.hashtags?.length
    ? `- **タグ**: ${a.hashtags.map((h) => h.hashtag.name).join(", ")}\n`
    : "";
  return `# ${a.name}

- **URL**: https://note.com/${a.user.urlname}/n/${a.key}
- **投稿者**: ${a.user.nickname}
- **投稿日**: ${date}
${tags}---

${htmlToMarkdown(a.body)}
`;
}

export function htmlToMarkdown(html: string): string {
  let t = html;
  t = t.replace(/<table-of-contents[^>]*>[\s\S]*?<\/table-of-contents>/gi, "");
  t = t.replace(/<embedded-content[^>]*>[\s\S]*?<\/embedded-content>/gi, "");
  t = t.replace(/<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, l, c) => `\n${"#".repeat(+l)} ${c}\n`);
  t = t.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, c) =>
    c.replace(/<li[^>]*>(?:<p[^>]*>)?([\s\S]*?)(?:<\/p>)?<\/li>/gi, "- $1\n"),
  );
  t = t.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, c) => {
    let i = 0;
    return c.replace(
      /<li[^>]*>(?:<p[^>]*>)?([\s\S]*?)(?:<\/p>)?<\/li>/gi,
      (_, content) => `${++i}. ${content}\n`,
    );
  });
  t = t.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "$1\n\n");
  t = t.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, "**$2**");
  t = t.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, "*$2*");
  t = t.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)");
  t = t.replace(
    /<figure[^>]*>[\s\S]*?<img[^>]*src="([^"]*)"[^>]*>[\s\S]*?(?:<figcaption>([\s\S]*?)<\/figcaption>)?[\s\S]*?<\/figure>/gi,
    (_, s, c) => `\n![${c || ""}](${s})\n`,
  );
  t = t.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/gi, "![$2]($1)");
  t = t.replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, "![]($1)");
  t = t.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, c) =>
    c
      .split("\n")
      .map((l: string) => `> ${l}`)
      .join("\n"),
  );
  t = t.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, "\n```\n$1\n```\n");
  t = t.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`");
  t = t.replace(/<br\s*\/?>/gi, "\n");
  t = t.replace(/<[^>]+>/g, "");
  for (const [e, c] of Object.entries({
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&nbsp;": " ",
  }))
    t = t.replace(new RegExp(e, "g"), c);
  t = t.replace(/&#(\d+);/g, (_, c) => String.fromCharCode(+c));
  t = t.replace(/&#x([0-9a-fA-F]+);/g, (_, c) => String.fromCharCode(parseInt(c, 16)));
  return t.replace(/\n{3,}/g, "\n\n").trim();
}
