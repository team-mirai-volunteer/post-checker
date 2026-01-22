import { describe, expect, test } from "vitest";
import {
  generateFilename,
  generateMarkdown,
  generateMeta,
  htmlToMarkdown,
} from "../../../src/application/fetchNoteArticlesUsecase.js";
import type { NoteApiArticle } from "../../../src/infra/noteClient.js";

describe("htmlToMarkdown", () => {
  test("見出しを変換", () => {
    expect(htmlToMarkdown("<h1>Title</h1>")).toBe("# Title");
    expect(htmlToMarkdown("<h2>Section</h2>")).toBe("## Section");
    expect(htmlToMarkdown("<h3>Sub</h3>")).toBe("### Sub");
  });

  test("段落を変換", () => {
    expect(htmlToMarkdown("<p>Hello</p><p>World</p>")).toBe("Hello\n\nWorld");
  });

  test("リストを変換", () => {
    expect(htmlToMarkdown("<ul><li>A</li><li>B</li></ul>")).toBe("- A\n- B");
  });

  test("番号付きリストを変換", () => {
    expect(htmlToMarkdown("<ol><li>First</li><li>Second</li></ol>")).toBe("1. First\n2. Second");
  });

  test("リンクを変換", () => {
    expect(htmlToMarkdown('<a href="https://example.com">Link</a>')).toBe(
      "[Link](https://example.com)",
    );
  });

  test("画像を変換", () => {
    expect(htmlToMarkdown('<img src="https://example.com/img.png" alt="Alt">')).toBe(
      "![Alt](https://example.com/img.png)",
    );
    expect(htmlToMarkdown('<img src="https://example.com/img.png">')).toBe(
      "![](https://example.com/img.png)",
    );
  });

  test("figure内の画像を変換", () => {
    const html =
      '<figure><img src="https://example.com/img.png"><figcaption>Caption</figcaption></figure>';
    expect(htmlToMarkdown(html)).toBe("![Caption](https://example.com/img.png)");
  });

  test("強調を変換", () => {
    expect(htmlToMarkdown("<strong>Bold</strong>")).toBe("**Bold**");
    expect(htmlToMarkdown("<em>Italic</em>")).toBe("*Italic*");
  });

  test("コードを変換", () => {
    expect(htmlToMarkdown("<code>inline</code>")).toBe("`inline`");
    expect(htmlToMarkdown("<pre><code>block</code></pre>")).toBe("```\nblock\n```");
  });

  test("引用を変換", () => {
    expect(htmlToMarkdown("<blockquote>Quote</blockquote>")).toBe("> Quote");
  });

  test("HTMLエンティティをデコード", () => {
    expect(htmlToMarkdown("&amp; &lt; &gt; &quot; &#39;")).toBe("& < > \" '");
    expect(htmlToMarkdown("&#65;&#66;")).toBe("AB");
    expect(htmlToMarkdown("&#x41;&#x42;")).toBe("AB");
  });

  test("note固有タグを除去", () => {
    expect(htmlToMarkdown("<table-of-contents>TOC</table-of-contents>text")).toBe("text");
    expect(htmlToMarkdown("<embedded-content>Embed</embedded-content>text")).toBe("text");
  });

  test("連続改行を正規化", () => {
    expect(htmlToMarkdown("<p>A</p>\n\n\n\n<p>B</p>")).toBe("A\n\nB");
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

  test("スペースをアンダースコアに変換", () => {
    const article = { ...baseArticle, name: "Hello   World  Test" };
    const filename = generateFilename(article);
    expect(filename).toBe("20240715_n1234567890ab_Hello_World_Test.md");
  });

  test("長いタイトルを50文字で切り詰め", () => {
    const article = { ...baseArticle, name: "A".repeat(100) };
    const filename = generateFilename(article);
    expect(filename).toBe(`20240715_n1234567890ab_${"A".repeat(50)}.md`);
  });

  test("日本語タイトルを処理", () => {
    const article = { ...baseArticle, name: "日本語タイトル" };
    const filename = generateFilename(article);
    expect(filename).toBe("20240715_n1234567890ab_日本語タイトル.md");
  });

  test("月・日を2桁でパディング", () => {
    const article = { ...baseArticle, publish_at: "2024-01-05T00:00:00.000+09:00" };
    const filename = generateFilename(article);
    expect(filename).toMatch(/^20240105_/);
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

  test("タグがない場合はタグ行を含まない", () => {
    const article: NoteApiArticle = {
      key: "n1234567890ab",
      name: "Test",
      body: "",
      publish_at: "2024-07-15T00:00:00.000+09:00",
      user: { nickname: "User", urlname: "user" },
    };

    const md = generateMarkdown(article);
    expect(md).not.toContain("タグ");
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
