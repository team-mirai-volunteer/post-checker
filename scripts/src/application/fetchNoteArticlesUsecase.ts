import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import TurndownService from "turndown";
import { stringify as yamlStringify } from "yaml";
import { fetchArticleDetail, fetchArticleList, type NoteApiArticle } from "../infra/noteClient.js";

// Turndownインスタンス（note.com固有タグを除去）
const turndown = new TurndownService({
  headingStyle: "atx", // # 形式
  codeBlockStyle: "fenced", // ``` 形式
});
turndown.addRule("note-custom-tags", {
  filter: (node) => ["table-of-contents", "embedded-content"].includes(node.nodeName.toLowerCase()),
  replacement: () => "",
});

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
  return turndown.turndown(html);
}
