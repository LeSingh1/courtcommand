"use client";

import Link from "next/link";
import { ChevronRight, Share2 } from "lucide-react";
import type { ToolMeta } from "@/lib/types";
import { getIcon } from "@/components/ui/icon";
import { getToolModel } from "@/lib/model";
import { categoryColor } from "@/lib/tools";
import { useState } from "react";

export function ToolShell({
  tool,
  children,
  intro,
}: {
  tool: ToolMeta;
  children: React.ReactNode;
  intro?: string;
}) {
  const Icon = getIcon(tool.icon);
  const color = categoryColor(tool.category);
  const [copied, setCopied] = useState(false);

  return (
    <div
      className="relative mx-auto max-w-6xl px-5 pb-28 pt-24 sm:px-8"
      style={{ ["--accent" as string]: color } as React.CSSProperties}
    >
      <nav className="mb-8 flex items-center gap-1.5 text-xs text-[var(--text-faint)]">
        <Link href="/" className="transition hover:text-[var(--text)]">
          Home
        </Link>
        <ChevronRight size={13} />
        <Link href="/tools" className="transition hover:text-[var(--text)]">
          Tools
        </Link>
        <ChevronRight size={13} />
        <span className="text-[var(--text-muted)]">{tool.short}</span>
      </nav>

      <div className="enter mb-10 flex flex-col gap-6 border-b border-[var(--line)] pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center border"
            style={{ borderColor: `${color}55`, color }}
          >
            <Icon size={22} strokeWidth={1.75} />
          </div>
          <div>
            <div className="kicker mb-2" style={{ color }}>
              {tool.category}
            </div>
            <h1 className="display text-4xl text-[var(--text)] sm:text-5xl">{tool.name}</h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--text-muted)]">
              {intro ?? tool.tagline}
            </p>
            <ModelTag slug={tool.slug} />
          </div>
        </div>
        <button
          onClick={() => {
            if (typeof navigator !== "undefined" && navigator.clipboard) {
              navigator.clipboard.writeText(
                typeof window !== "undefined" ? window.location.href : "",
              );
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            }
          }}
          className="btn-ghost inline-flex h-10 shrink-0 items-center gap-2 px-4 text-sm"
        >
          <Share2 size={15} strokeWidth={1.75} />
          {copied ? "Link copied" : "Share"}
        </button>
      </div>

      {children}

      <div className="mt-16 border-t border-[var(--line)] pt-5 text-xs text-[var(--text-faint)]">
        Computed by the CourtCommand engine. Connect a live NBA feed in{" "}
        <code className="border border-[var(--line)] px-1 py-0.5 text-[var(--text-muted)]">
          /src/lib/engine
        </code>
        .
      </div>
    </div>
  );
}

export function Panel({
  title,
  children,
  right,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`border border-[var(--line)] bg-[var(--surface)] p-5 transition-colors duration-200 hover:border-[var(--line-strong)] ${className ?? ""}`}
    >
      {(title || right) && (
        <div className="mb-4 flex items-center justify-between border-b border-[var(--line)] pb-3">
          {title && (
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              {title}
            </h3>
          )}
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

function ModelTag({ slug }: { slug: string }) {
  const model = getToolModel(slug);
  if (!model) return null;
  return (
    <div className="mt-4 inline-flex flex-wrap items-center gap-x-3 gap-y-1 border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[11px]">
      <span className="flex items-center gap-1.5 font-semibold uppercase tracking-wider text-[var(--accent)]">
        <span className="inline-block h-1.5 w-1.5 bg-[var(--accent)]" />
        Trained model
      </span>
      <span className="text-[var(--text-muted)]">{model.kind}</span>
      <span className="stat-num text-[var(--text)]">{model.metric}</span>
      <span className="text-[var(--text-faint)]">· 2003–25</span>
    </div>
  );
}

export function Insight({
  children,
  accent,
}: {
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="border border-[var(--line)] bg-[var(--surface)] p-4 pl-5">
      <div className="border-l-2 pl-4" style={{ borderColor: accent ?? "var(--accent)" }}>
        <div className="kicker mb-1.5">Read</div>
        <div className="text-sm leading-relaxed text-[var(--text-muted)]">{children}</div>
      </div>
    </div>
  );
}
