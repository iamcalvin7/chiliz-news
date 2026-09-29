import { ExternalLink, Flame, Rss, TriangleAlert } from "lucide-react";
import { getNews } from "@/lib/news";
import { NewsExplorer } from "@/components/news-explorer";

export const revalidate = 900;

export default async function Home() {
  const { items, fallback } = await getNews();
  const sourceCount = new Set(items.map((item) => item.source)).size;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-edge bg-ink/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-brand text-ink">
              <Flame className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-white">
                Chiliz News Hub
              </p>
              <p className="text-xs text-zinc-500">Unofficial aggregator</p>
            </div>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-zinc-400 sm:flex">
            <a
              href="https://www.chiliz.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 transition-colors hover:text-white"
            >
              Chiliz
              <ExternalLink className="size-3.5" />
            </a>
            <a
              href="https://www.socios.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 transition-colors hover:text-white"
            >
              Socios.com
              <ExternalLink className="size-3.5" />
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        <section className="py-14 sm:py-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-edge bg-panel px-3 py-1 text-xs font-medium text-zinc-400">
            <Rss className="size-3.5 text-brand" />
            Live feed via Google News RSS
          </span>
          <h1 className="mt-5 max-w-2xl text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Every{" "}
            <span className="text-brand">Chiliz</span> headline. One hub.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-zinc-400">
            All the latest news articles mentioning Chiliz, Socios.com and fan
            tokens — collected from across the web and refreshed every 15
            minutes.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 text-sm">
            <span className="rounded-full border border-edge bg-panel px-3.5 py-1.5 text-zinc-300">
              <span className="font-semibold text-white">{items.length}</span>{" "}
              articles
            </span>
            <span className="rounded-full border border-edge bg-panel px-3.5 py-1.5 text-zinc-300">
              <span className="font-semibold text-white">{sourceCount}</span>{" "}
              sources
            </span>
            <span className="rounded-full border border-edge bg-panel px-3.5 py-1.5 text-zinc-300">
              3 topics tracked
            </span>
          </div>
        </section>

        {fallback && (
          <div className="mb-10 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <p>
              Live feed is unavailable right now. Showing curated links for
              Chiliz, Socios.com and fan tokens instead.
            </p>
          </div>
        )}

        <NewsExplorer items={items} />
      </main>

      <footer className="mt-16 border-t border-edge">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-8 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Chiliz News Hub is an unofficial aggregator. Not affiliated with
            Chiliz or Socios.
          </p>
          <p>Headlines via Google News RSS · {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}
