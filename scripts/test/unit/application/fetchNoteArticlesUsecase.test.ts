import { describe, expect, test } from "vitest";
import {
  generateFilename,
  generateMarkdown,
  generateMeta,
  htmlToMarkdown,
} from "../../../src/application/fetchNoteArticlesUsecase.js";
import type { NoteApiArticle } from "../../../src/infra/noteClient.js";

describe("htmlToMarkdown", () => {
  test("note固有タグを除去", () => {
    expect(htmlToMarkdown("<table-of-contents>TOC</table-of-contents>text")).toBe("text");
    expect(htmlToMarkdown("<embedded-content>Embed</embedded-content>text")).toBe("text");
  });
});

describe("generateFilename", () => {
  const baseArticle: NoteApiArticle = {
    key: "n1234567890ab",
    name: "Test Title",
    body: "",
    publish_at: "2024-07-15T10:30:00.000+09:00",
    user: { nickname: "Test User", urlname: "testuser" },
  };

  test("基本的なファイル名を生成", () => {
    const filename = generateFilename(baseArticle);
    expect(filename).toBe("20240715_n1234567890ab_Test_Title.md");
  });

  test("特殊文字を除去", () => {
    const article = { ...baseArticle, name: 'Title: "Test" <File>' };
    const filename = generateFilename(article);
    expect(filename).toBe("20240715_n1234567890ab_Title_Test_File.md");
  });

  test("長いタイトルを50文字で切り詰め", () => {
    const article = { ...baseArticle, name: "A".repeat(100) };
    const filename = generateFilename(article);
    expect(filename).toBe(`20240715_n1234567890ab_${"A".repeat(50)}.md`);
  });
});

describe("generateMarkdown", () => {
  test("メタデータとボディを含むMarkdownを生成", () => {
    const article: NoteApiArticle = {
      key: "n1234567890ab",
      name: "Test Article",
      body: "<p>Hello World</p>",
      publish_at: "2024-07-15T10:30:00.000+09:00",
      user: { nickname: "Test User", urlname: "testuser" },
      hashtags: [{ hashtag: { name: "tag1" } }, { hashtag: { name: "tag2" } }],
    };

    const md = generateMarkdown(article);

    expect(md).toContain("# Test Article");
    expect(md).toContain("https://note.com/testuser/n/n1234567890ab");
    expect(md).toContain("**投稿者**: Test User");
    expect(md).toContain("**投稿日**: 2024-07-15");
    expect(md).toContain("**タグ**: tag1, tag2");
    expect(md).toContain("Hello World");
  });
});

describe("generateMeta", () => {
  test("メタデータオブジェクトを生成", () => {
    const article: NoteApiArticle = {
      key: "n1234567890ab",
      name: "Test Article",
      body: "",
      publish_at: "2024-07-15T10:30:00.000+09:00",
      user: { nickname: "Test User", urlname: "testuser" },
    };
    const filename = "20240715_n1234567890ab_Test_Article.md";

    const meta = generateMeta(article, filename);

    expect(meta).toEqual({
      key: "n1234567890ab",
      title: "Test Article",
      url: "https://note.com/testuser/n/n1234567890ab",
      publishedAt: "2024-07-15",
      filename: "20240715_n1234567890ab_Test_Article.md",
    });
  });
});
