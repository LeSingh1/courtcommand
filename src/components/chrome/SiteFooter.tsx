import Link from "next/link";
import { TOOLS, CATEGORIES, categoryColor } from "@/lib/tools";
import { PLAYERS } from "@/lib/data";

export function SiteFooter() {
  return (
    <footer className="relative mt-20 border-t border-[var(--line)] bg-[var(--bg)]">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <div className="text-lg font-bold tracking-tight text-[var(--text)]">
              COURT<span className="text-[var(--accent)]">COMMAND</span>
            </div>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-[var(--text-muted)]">
              A basketball intelligence terminal. Thirty rigorous NBA analytics instruments in one
              place.
            </p>
          </div>

          {CATEGORIES.slice(0, 3).map((cat) => (
            <div key={cat}>
              <div className="kicker mb-4" style={{ color: categoryColor(cat) }}>
                {cat}
              </div>
              <ul className="flex flex-col gap-2.5">
                {TOOLS.filter((t) => t.category === cat)
                  .slice(0, 5)
                  .map((t) => (
                    <li key={t.slug}>
                      <Link
                        href={`/tools/${t.slug}`}
                        className="text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--accent)]"
                      >
                        {t.short}
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-[var(--line)] pt-6 text-xs text-[var(--text-faint)] sm:flex-row">
          <span>Next.js · TypeScript · real ESPN data · custom analytics engine</span>
          <span className="stat-num">30 tools · {PLAYERS.length} players · 30 teams</span>
        </div>
      </div>
    </footer>
  );
}
