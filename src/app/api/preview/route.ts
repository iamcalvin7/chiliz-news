import { NextRequest, NextResponse } from "next/server";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const MAX_HTML_BYTES = 2_000_000;

const BROWSER_HEADERS: Record<string, string> = {
  "user-agent": USER_AGENT,
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
};

function isBlockedHost(host: string): boolean {
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local")
  ) {
    return true;
  }
  if (host === "::1" || host.startsWith("[::")) return true;
  if (/^(10|127)\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^169\.254\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  return false;
}

function safeUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (isBlockedHost(url.hostname.toLowerCase())) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function decodeEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/\s+/g, " ")
    .trim();
}

function metaContent(html: string, attribute: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(
      `<meta[^>]*${attribute}=["']${escaped}["'][^>]*content=["']([^"']*)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]*content=["']([^"']*)["'][^>]*${attribute}=["']${escaped}["']`,
      "i",
    ),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeEntities(match[1]);
  }
  return "";
}

function extractParagraphs(html: string): string[] {
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ");

  const paragraphs: string[] = [];
  for (const match of body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
    const text = decodeEntities(match[1].replace(/<[^>]*>/g, " "));
    if (text.length < 40) continue;
    if (/^(read more|subscribe|sign in|log in|share this)/i.test(text)) {
      continue;
    }
    paragraphs.push(text);
    if (paragraphs.length >= 8) break;
  }
  return paragraphs;
}

async function resolveGoogleNewsUrl(articleId: string): Promise<string | null> {
  try {
    const page = await fetch(
      `https://news.google.com/rss/articles/${articleId}`,
      { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(6000) },
    );
    if (!page.ok) return null;
    const html = await page.text();
    const signature = html.match(/data-n-a-sg="([^"]+)"/)?.[1];
    const timestamp = html.match(/data-n-a-ts="([^"]+)"/)?.[1];
    if (!signature || !timestamp) return null;

    const payload = [
      "Fbv4je",
      `["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0],"${articleId}",${timestamp},"${signature}"]`,
    ];
    const response = await fetch(
      "https://news.google.com/_/DotsSplashUi/data/batchexecute",
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
          "user-agent": USER_AGENT,
          origin: "https://news.google.com",
          referer: "https://news.google.com/",
        },
        body: `f.req=${encodeURIComponent(JSON.stringify([[payload]]))}`,
        signal: AbortSignal.timeout(6000),
        cache: "no-store",
      },
    );
    if (!response.ok) return null;
    const text = await response.text();
    const chunk = text.split("\n\n")[1];
    if (!chunk) return null;
    const parsed = JSON.parse(chunk);
    const inner = JSON.parse(parsed[0][2]);
    const decoded = inner[1];
    return typeof decoded === "string" && decoded.startsWith("http")
      ? decoded
      : null;
  } catch {
    return null;
  }
}

function googleNewsArticleId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "news.google.com") return null;
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const kind = parts[parts.length - 2];
    if (kind !== "articles" && kind !== "read") return null;
    return parts[parts.length - 1];
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const target = safeUrl(request.nextUrl.searchParams.get("url"));
  if (!target) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  let fetchTarget = target;
  const articleId = googleNewsArticleId(target);
  if (articleId) {
    const decoded = await resolveGoogleNewsUrl(articleId);
    if (!decoded) {
      return NextResponse.json(
        { error: "Live preview is unavailable for this article" },
        { status: 502 },
      );
    }
    fetchTarget = decoded;
  }

  try {
    const response = await fetch(fetchTarget, {
      headers: BROWSER_HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Source responded with ${response.status}` },
        { status: 502 },
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      return NextResponse.json(
        { error: "Source is not an HTML page" },
        { status: 502 },
      );
    }

    const html = (await response.text()).slice(0, MAX_HTML_BYTES);
    const resolved = response.url || fetchTarget;

    const title =
      metaContent(html, "property", "og:title") ||
      metaContent(html, "name", "twitter:title") ||
      decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");

    const description =
      metaContent(html, "property", "og:description") ||
      metaContent(html, "name", "description") ||
      metaContent(html, "name", "twitter:description");

    const image =
      metaContent(html, "property", "og:image") ||
      metaContent(html, "name", "twitter:image") ||
      metaContent(html, "name", "twitter:image:src");

    const siteName =
      metaContent(html, "property", "og:site_name") ||
      new URL(resolved).hostname.replace(/^www\./, "");

    const paragraphs = extractParagraphs(html);

    return NextResponse.json({
      title,
      description,
      image,
      siteName,
      paragraphs,
      url: resolved,
    });
  } catch {
    return NextResponse.json(
      { error: "Live preview is unavailable for this article" },
      { status: 502 },
    );
  }
}
