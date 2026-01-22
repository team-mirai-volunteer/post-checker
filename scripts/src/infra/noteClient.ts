/**
 * note.com 非公式APIクライアント
 */

const BASE_URL = "https://note.com/api";

export interface NoteApiArticle {
  key: string;
  name: string;
  body: string;
  publish_at: string;
  user: { nickname: string; urlname: string };
  hashtags?: Array<{ hashtag: { name: string } }>;
}

export async function fetchArticleList(
  username: string,
  limit?: number,
): Promise<{ key: string; name: string }[]> {
  const articles: { key: string; name: string }[] = [];
  let page = 1;
  let isLastPage = false;

  while (!isLastPage) {
    const res = await fetch(`${BASE_URL}/v2/creators/${username}/contents?kind=note&page=${page}`);
    if (!res.ok) throw new Error(`Failed to fetch articles: ${res.status}`);
    const json = await res.json();
    articles.push(...json.data.contents);
    isLastPage = json.data.isLastPage;
    if (limit && articles.length >= limit) return articles.slice(0, limit);
    page++;
    if (!isLastPage) await new Promise((r) => setTimeout(r, 1000));
  }
  return articles;
}

export async function fetchArticleDetail(noteKey: string): Promise<NoteApiArticle> {
  const res = await fetch(`${BASE_URL}/v3/notes/${noteKey}`);
  if (!res.ok) throw new Error(`Failed to fetch article: ${res.status}`);
  return (await res.json()).data;
}
