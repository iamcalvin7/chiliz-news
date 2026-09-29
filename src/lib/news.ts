import { XMLParser } from "fast-xml-parser";

export type CategorySlug = "chiliz" | "socios" | "fan-tokens";

export interface NewsItem {
  id: string;
  title: string;
  link: string;
  source: string;
  publishedAt: string;
  summary: string;
  categories: CategorySlug[];
}

export interface NewsResult {
  items: NewsItem[];
  fallback: boolean;
  fetchedAt: string;
}

const FEEDS: { slug: CategorySlug; url: string }[] = [
  {
    slug: "chiliz",
    url: "https://news.google.com/rss/search?q=%22Chiliz%22&hl=en-US&gl=US&ceid=US:en",
  },
  {
    slug: "socios",
    url: "https://news.google.com/rss/search?q=%22Socios.com%22&hl=en-US&gl=US&ceid=US:en",
  },
  {
    slug: "fan-tokens",
    url: "https://news.google.com/rss/search?q=%22Fan+tokens%22&hl=en-US&gl=US&ceid=US:en",
  },
];

const FALLBACK_ITEMS: NewsItem[] = [
  {
    id: "https://www.chiliz.com",
    title: "Chiliz — official website",
    link: "https://www.chiliz.com",
    source: "chiliz.com",
    publishedAt: "",
    summary: "Official home of Chiliz, the sports and entertainment blockchain company.",
    categories: ["chiliz"],
  },
  {
    id: "https://www.socios.com",
    title: "Socios.com — official website",
    link: "https://www.socios.com",
    source: "socios.com",
    publishedAt: "",
    summary: "Fan engagement and fan token platform for major sports clubs.",
    categories: ["socios", "fan-tokens"],
  },
  {
    id: "https://chilizchain.com",
    title: "Chiliz Chain — official website",
    link: "https://chilizchain.com",
    source: "chilizchain.com",
    publishedAt: "",
    summary: "EVM-compatible blockchain powering Chiliz and Socios.",
    categories: ["chiliz", "fan-tokens"],
  },
];

interface RawRssEntry {
  title?: unknown;
  link?: unknown;
  pubDate?: unknown;
  description?: unknown;
  source?: unknown;
}

interface RssDocument {
  rss?: { channel?: { item?: unknown } };
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function asText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return asText(record["#text"] ?? record["@_url"] ?? "");
  }
  return String(value);
}

function extractSource(title: string): { title: string; source: string } {
  const parts = title.split(" - ");
  const last = parts[parts.length - 1]?.trim() ?? "";
  if (parts.length > 1 && last.length > 0 && last.length <= 32) {
    return { title: parts.slice(0, -1).join(" - ").trim(), source: last };
  }
  return { title, source: "" };
}

function buildSummary(raw: string): string {
  const summary = stripHtml(raw);
  if (summary.length < 24) return "";
  if (/^visit (the )?link/i.test(summary)) return "";
  if (summary.toLowerCase() === "") return "";
  return summary;
}

function detectCategories(text: string): CategorySlug[] {
  const haystack = text.toLowerCase();
  const categories: CategorySlug[] = [];
  if (haystack.includes("chiliz")) categories.push("chiliz");
  if (haystack.includes("socios")) categories.push("socios");
  if (haystack.includes("fan token") || haystack.includes("fan-token")) {
    categories.push("fan-tokens");
  }
  return categories;
}

function toNewsItem(entry: RawRssEntry, feedSlug: CategorySlug): NewsItem | null {
  const link = asText(entry.link).trim();
  if (!link || !link.startsWith("http")) return null;

  const rawTitle = stripHtml(asText(entry.title));
  if (!rawTitle) return null;

  const extracted = extractSource(rawTitle);
  const sourceTag = asText(entry.source).trim();
  const source = sourceTag || extracted.source || "News";

  const title = stripSourceSuffix(extracted.title, source);
  const summary = buildSummary(asText(entry.description));
  const publishedAt = asText(entry.pubDate)
    ? new Date(asText(entry.pubDate)).toISOString()
    : "";

  const categories = detectCategories(`${title} ${summary}`);
  if (!categories.includes(feedSlug)) categories.push(feedSlug);

  return { id: link, title, link, source, publishedAt, summary, categories };
}

function stripSourceSuffix(title: string, source: string): string {
  const suffix = ` - ${source}`;
  return title.endsWith(suffix) ? title.slice(0, -suffix.length).trim() : title;
}

async function fetchFeed(feed: (typeof FEEDS)[number]): Promise<NewsItem[]> {
  try {
    const response = await fetch(feed.url, {
      headers: { "user-agent": "chiliz-news-hub/0.1" },
      next: { revalidate: 900 },
    });
    if (!response.ok) return [];
    const text = await response.text();
    const doc = parser.parse(text) as RssDocument;
    const rawItems = doc?.rss?.channel?.item;
    if (!rawItems) return [];
    const list = Array.isArray(rawItems) ? rawItems : [rawItems];
    return list
      .map((entry) => toNewsItem(entry as RawRssEntry, feed.slug))
      .filter((item): item is NewsItem => item !== null);
  } catch {
    return [];
  }
}

export async function getNews(): Promise<NewsResult> {
  const settled = await Promise.allSettled(FEEDS.map(fetchFeed));
  const byLink = new Map<string, NewsItem>();

  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    for (const item of result.value) {
      const key = item.link.replace(/[?#].*$/, "");
      const existing = byLink.get(key);
      if (existing) {
        existing.categories = [
          ...new Set([...existing.categories, ...item.categories]),
        ];
      } else {
        byLink.set(key, item);
      }
    }
  }

  const items = [...byLink.values()]
    .filter((item) => item.publishedAt)
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    );

  return {
    items: items.length > 0 ? items : FALLBACK_ITEMS,
    fallback: items.length === 0,
    fetchedAt: new Date().toISOString(),
  };
}
