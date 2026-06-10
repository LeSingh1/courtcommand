import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Hero } from "@/components/home/Hero";
import { Ticker } from "@/components/home/Ticker";
import { ToolCard } from "@/components/ui/ToolCard";
import { Reveal } from "@/components/ui/Reveal";
import { TOOLS, CATEGORIES, categoryColor } from "@/lib/tools";
import { HomePreviews } from "@/components/home/HomePreviews";

const BETTING_GREEN = "#4D8DFF";

// Oversized hollow numeral that anchors each section like a magazine spread.
function SectionMark({ n, kicker, title }: { n: string; kicker: string; title: string }) {
  return (
    <div className="relative mb-8 border-t border-[var(--line)] pt-8">
      <span className="outline-display pointer-events-none absolute -top-3 right-0 hidden text-[7rem] sm:block" aria-hidden>
        {n}
      </span>
      <div className="kicker mb-3" style={{ color: "var(--accent)" }}>{kicker}</div>
      <h2 className="display max-w-2xl text-3xl text-[var(--text)] sm:text-4xl">{title}</h2>
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      <Hero />
      <Ticker />

      {/* Live previews */}
      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
        <Reveal>
          <SectionMark n="01" kicker="Live engine" title="Every figure is computed, not illustrated." />
          <p className="-mt-4 mb-8 max-w-xl text-sm leading-relaxed text-[var(--text-muted)]">
            The panels below run on the same deterministic engine that powers all thirty tools.
          </p>
        </Reveal>
        <HomePreviews />
      </section>

      {/* Tool grid by category */}
      <section className="mx-auto max-w-7xl px-5 pb-16 sm:px-8">
        <Reveal>
          <div className="relative">
            <SectionMark n="02" kicker="The arsenal" title="Thirty instruments" />
            <Link
              href="/tools"
              className="link-underline absolute bottom-1 right-0 hidden items-center gap-1.5 text-sm text-[var(--text-muted)] transition hover:text-[var(--text)] sm:inline-flex"
            >
              Browse all <ArrowRight size={15} strokeWidth={2} />
            </Link>
          </div>
        </Reveal>

        {CATEGORIES.map((cat) => {
          const tools = TOOLS.filter((t) => t.category === cat);
          return (
            <div key={cat} className="mt-12">
              <Reveal>
                <div className="mb-5 flex items-center gap-3">
                  <span className="h-3 w-1" style={{ background: categoryColor(cat) }} />
                  <h3
                    className="text-sm font-medium"
                    style={{ color: categoryColor(cat) }}
                  >
                    {cat}
                  </h3>
                  <div className="h-px flex-1 bg-[var(--line)]" />
                  <span className="stat-num text-xs text-[var(--text-faint)]">
                    {String(tools.length).padStart(2, "0")}
                  </span>
                </div>
              </Reveal>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {tools.map((t, i) => (
                  <ToolCard key={t.slug} tool={t} index={TOOLS.indexOf(t)} />
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {/* Betting */}
      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
        <Reveal>
          <Link
            href="/betting"
            className="lift card-frame group block border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-2)]"
            style={{ ["--card-accent" as string]: BETTING_GREEN }}
          >
            <div className="grid gap-6 p-8 sm:grid-cols-[1.4fr_1fr] sm:items-center sm:p-10">
              <div>
                <div className="kicker mb-3 flex items-center gap-2" style={{ color: BETTING_GREEN }}>
                  <span className="h-px w-8" style={{ background: BETTING_GREEN }} />
                  New · Betting
                </div>
                <h2 className="display text-3xl text-[var(--text)] sm:text-4xl">
                  The <span className="display-italic" style={{ color: BETTING_GREEN }}>EdgeBoard</span> model, built in.
                </h2>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-[var(--text-muted)]">
                  Recency-weighted prop projections, a normal-CDF edge over the book line, and a
                  Poisson-binomial lineup optimizer with demon/goblin payouts. Build a slip, see your
                  expected value.
                </p>
                <span
                  className="mt-5 inline-flex items-center gap-2 text-sm font-semibold"
                  style={{ color: BETTING_GREEN }}
                >
                  Open the Edge Board
                  <ArrowRight size={15} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
              <div className="grid grid-cols-3 gap-px border border-[var(--line)] bg-[var(--line)]">
                {[
                  { k: "P(over)", l: "Normal CDF" },
                  { k: "EV", l: "Poisson-binomial" },
                  { k: "1.5×", l: "Demon payouts" },
                ].map((s) => (
                  <div key={s.l} className="bg-[var(--surface)] p-4 text-center">
                    <div className="scoreboard text-xl" style={{ color: BETTING_GREEN }}>{s.k}</div>
                    <div className="mt-1 text-[10px] text-[var(--text-faint)]">{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          </Link>
        </Reveal>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
        <Reveal>
          <div className="card-frame border border-[var(--line)] bg-[var(--surface)] px-8 py-16 text-center sm:py-20">
            <h2 className="display mx-auto max-w-2xl text-3xl text-[var(--text)] sm:text-4xl">
              Settle the argument with the numbers.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-[var(--text-muted)]">
              Open the command bar and ask anything. CourtCommand routes your question to the right
              instrument.
            </p>
            <Link
              href="/tools"
              className="btn-accent mt-8 inline-flex items-center gap-2 px-7 py-3.5 text-sm"
            >
              Start exploring <ArrowRight size={15} strokeWidth={2} />
            </Link>
          </div>
        </Reveal>
      </section>

    </>
  );
}
