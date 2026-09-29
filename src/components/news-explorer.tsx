"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, Portal, Tabs } from "@ark-ui/react";
import {
  ArrowUpRight,
  ExternalLink,
  Eye,
  LoaderCircle,
  Newspaper,
  Search,
  SearchX,
  TriangleAlert,
  X,
} from "lucide-react";
import type { CategorySlug, NewsItem } from "@/lib/news";

interface PreviewData {
  title: string;
  description: string;
  image: string;
  siteName: string;
  paragraphs: string[];
  url: string;
}

type Filter = "all" | CategorySlug;

const CATEGORY_STYLE: Record<CategorySlug, string> = {
  chiliz: "bg-brand/15 text-brand",
  socios: "bg-violet-500/15 text-violet-300",
  "fan-tokens": "bg-sky-500/15 text-sky-300",
};

const CATEGORY_LABEL: Record<CategorySlug, string> = {
  chiliz: "Chiliz",
  socios: "Socios.com",
  "fan-tokens": "Fan tokens",
};

function formatDate(iso: string): string {
  const date = new Date(iso);
  return `${date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}, ${date.getFullYear()}`;
}

function ArticleCard({
  item,
  onPreview,
}: {
  item: NewsItem;
  onPreview: (item: NewsItem) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPreview(item)}
      className="group flex cursor-pointer flex-col gap-3 rounded-2xl border border-edge bg-panel p-5 text-left transition-colors hover:border-brand/40"
    >
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-edge/70 px-2.5 py-1 font-medium text-zinc-300">
          <Newspaper className="size-3 shrink-0" />
          <span className="truncate">{item.source}</span>
        </span>
        {item.publishedAt && (
          <time
            dateTime={item.publishedAt}
            className="shrink-0 text-zinc-500"
          >
            {formatDate(item.publishedAt)}
          </time>
        )}
      </div>
      <span className="line-clamp-3 text-[15px] font-semibold leading-snug text-white transition-colors group-hover:text-brand">
        {item.title}
      </span>
      {item.summary && (
        <span className="line-clamp-2 text-sm text-zinc-400">
          {item.summary}
        </span>
      )}
      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <div className="flex flex-wrap gap-1.5">
          {item.categories.map((category) => (
            <span
              key={category}
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${CATEGORY_STYLE[category]}`}
            >
              {CATEGORY_LABEL[category]}
            </span>
          ))}
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-zinc-500 transition-colors group-hover:text-brand">
          Preview
          <Eye className="size-3.5" />
        </span>
      </div>
    </button>
  );
}

function ArticlePreview({
  item,
  onClose,
}: {
  item: NewsItem;
  onClose: () => void;
}) {
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [failed, setFailed] = useState(false);
  const [imageVisible, setImageVisible] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setPreview(null);
    setFailed(false);
    fetch(`/api/preview?url=${encodeURIComponent(item.link)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("preview failed");
        return (await response.json()) as PreviewData;
      })
      .then((data) => setPreview(data))
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [item.link]);

  const showImage = Boolean(preview?.image) && imageVisible;

  return (
    <Dialog.Root
      open
      onOpenChange={(details) => {
        if (!details.open) onClose();
      }}
    >
      <Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Positioner className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Content className="max-h-[85dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-edge bg-panel p-6 shadow-2xl focus:outline-none">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 flex-wrap items-center gap-2.5 text-xs">
                <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-edge/70 px-2.5 py-1 font-medium text-zinc-300">
                  <Newspaper className="size-3 shrink-0" />
                  <span className="truncate">
                    {preview?.siteName || item.source}
                  </span>
                </span>
                {item.publishedAt && (
                  <time dateTime={item.publishedAt} className="text-zinc-500">
                    {formatDate(item.publishedAt)}
                  </time>
                )}
              </div>
              <Dialog.CloseTrigger
                aria-label="Close preview"
                className="shrink-0 rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-edge/70 hover:text-white"
              >
                <X className="size-4" />
              </Dialog.CloseTrigger>
            </div>

            {showImage && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={preview?.image}
                alt=""
                referrerPolicy="no-referrer"
                onError={() => setImageVisible(false)}
                className="mt-4 max-h-72 w-full rounded-xl border border-edge object-cover"
              />
            )}

            <Dialog.Title className="mt-4 text-xl font-bold leading-snug text-white sm:text-2xl">
              {item.title}
            </Dialog.Title>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {item.categories.map((category) => (
                <span
                  key={category}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${CATEGORY_STYLE[category]}`}
                >
                  {CATEGORY_LABEL[category]}
                </span>
              ))}
            </div>

            <div className="mt-4 space-y-3 text-sm leading-relaxed text-zinc-300">
              {preview
                ? (preview.paragraphs.length > 0
                    ? preview.paragraphs.slice(0, 6)
                    : [preview.description || item.summary]
                  )
                    .filter(Boolean)
                    .map((paragraph, index) => <p key={index}>{paragraph}</p>)
                : item.summary && (
                    <Dialog.Description>{item.summary}</Dialog.Description>
                  )}
            </div>

            {!preview && !failed && (
              <div className="mt-5 space-y-2.5" aria-hidden="true">
                <div className="h-3 w-full animate-pulse rounded bg-edge" />
                <div className="h-3 w-11/12 animate-pulse rounded bg-edge" />
                <div className="h-3 w-4/5 animate-pulse rounded bg-edge" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-edge" />
              </div>
            )}

            {failed && (
              <p className="mt-5 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                Live preview is unavailable for this article. Open the full
                article on the source site instead.
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href={preview?.url || item.link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-brand/85"
              >
                Open full article
                <ArrowUpRight className="size-4" />
              </a>
              {!preview && !failed && (
                <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
                  <LoaderCircle className="size-3.5 animate-spin" />
                  Loading live preview...
                </span>
              )}
            </div>

            <p className="mt-4 truncate border-t border-edge pt-4 text-xs text-zinc-600">
              {preview?.url || item.link}
            </p>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

export function NewsExplorer({ items }: { items: NewsItem[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<NewsItem | null>(null);

  const counts = useMemo(() => {
    const map: Record<Filter, number> = {
      all: items.length,
      chiliz: 0,
      socios: 0,
      "fan-tokens": 0,
    };
    for (const item of items) {
      for (const category of item.categories) {
        map[category] += 1;
      }
    }
    return map;
  }, [items]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (filter !== "all" && !item.categories.includes(filter)) return false;
      if (!needle) return true;
      return (
        item.title.toLowerCase().includes(needle) ||
        item.source.toLowerCase().includes(needle)
      );
    });
  }, [items, filter, query]);

  const tabs: { value: Filter; label: string }[] = [
    { value: "all", label: "All news" },
    { value: "chiliz", label: "Chiliz" },
    { value: "socios", label: "Socios.com" },
    { value: "fan-tokens", label: "Fan tokens" },
  ];

  return (
    <>
      <section aria-label="News articles" className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <Tabs.Root
            value={filter}
            onValueChange={(details) => setFilter(details.value as Filter)}
          >
            <Tabs.List className="inline-flex flex-wrap gap-1 rounded-full border border-edge bg-panel p-1">
              {tabs.map((tab) => (
                <Tabs.Trigger
                  key={tab.value}
                  value={tab.value}
                  className="rounded-full px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:text-white data-[selected=true]:bg-brand data-[selected=true]:text-ink"
                >
                  {tab.label}
                  <span className="ml-1.5 text-xs opacity-70">
                    {counts[tab.value]}
                  </span>
                </Tabs.Trigger>
              ))}
            </Tabs.List>
          </Tabs.Root>
          <div className="relative md:w-72">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search articles, sources..."
              aria-label="Search articles"
              className="h-11 w-full rounded-xl border border-edge bg-panel pl-10 pr-10 text-sm text-white outline-none transition-colors placeholder:text-zinc-500 focus:border-brand/60 focus:ring-2 focus:ring-brand/20"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors hover:text-white"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-edge py-16 text-center">
            <SearchX className="size-8 text-zinc-600" />
            <p className="font-medium text-white">
              No articles match &ldquo;{query}&rdquo;
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setFilter("all");
              }}
              className="text-sm font-medium text-brand hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((item) => (
              <ArticleCard
                key={item.id}
                item={item}
                onPreview={setSelected}
              />
            ))}
          </div>
        )}

        {filtered.length > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-zinc-500">
            Showing {filtered.length} of {items.length} articles
            <ExternalLink className="size-3" />
          </p>
        )}
      </section>

      {selected && (
        <ArticlePreview item={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
