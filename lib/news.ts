import type { NewsData, NewsItem } from "@/types";

// BBC World News RSS — free, no API key, reliable
const FEED_URL = "https://feeds.bbci.co.uk/news/world/rss.xml";
const FEED_SOURCE = "BBC World";
const MAX_ITEMS = 5;

function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/${tag}>`, "s"));
  return match?.[1]?.trim() ?? "";
}

function parseItems(xml: string): NewsItem[] {
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
  const items: NewsItem[] = [];

  for (const match of itemMatches) {
    const block = match[1];
    const title = extractTag(block, "title");
    const description = extractTag(block, "description");
    const url = extractTag(block, "link") || extractTag(block, "guid");
    const pubDate = extractTag(block, "pubDate");

    if (title) {
      items.push({ title, description, url, pubDate });
    }

    if (items.length >= MAX_ITEMS) break;
  }

  return items;
}

export async function getNewsData(): Promise<NewsData> {
  const response = await fetch(FEED_URL, {
    cache: "no-store",
    headers: { "User-Agent": "Pulse/1.0 (personal dashboard)" },
  });

  if (!response.ok) {
    throw new Error("Unable to fetch news feed");
  }

  const xml = await response.text();
  const items = parseItems(xml);

  if (items.length === 0) {
    throw new Error("No news items found in feed");
  }

  return { items, source: FEED_SOURCE };
}
