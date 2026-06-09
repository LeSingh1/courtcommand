import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ToolMeta } from "@/lib/types";
import { getIcon } from "@/components/ui/icon";
import { categoryColor } from "@/lib/tools";

export function ToolCard({ tool, index = 0 }: { tool: ToolMeta; index?: number }) {
  const Icon = getIcon(tool.icon);
  const num = String(index + 1).padStart(2, "0");
  const color = categoryColor(tool.category);

  return (
    <Link href={`/tools/${tool.slug}`} className="reveal group block h-full">
      <div
        className="lift relative flex h-full flex-col overflow-hidden border border-[var(--line)] bg-[var(--surface)] p-5 hover:bg-[var(--surface-2)]"
        style={{ ["--cat" as string]: color }}
      >
        {/* category accent rule revealed on hover */}
        <span
          className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100"
          style={{ background: color }}
        />
        <div className="mb-5 flex items-start justify-between">
          <div
            className="flex h-10 w-10 items-center justify-center border transition-colors duration-300"
            style={{ borderColor: `${color}40`, color }}
          >
            <Icon size={18} strokeWidth={1.75} />
          </div>
          <span className="scoreboard text-xl text-[var(--text-faint)]">{num}</span>
        </div>
        <h3 className="font-semibold tracking-tight text-[var(--text)] group-hover:text-white">{tool.name}</h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-muted)]">{tool.tagline}</p>
        <div className="mt-auto flex items-center justify-between border-t border-[var(--line)] pt-4">
          <span
            className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em]"
            style={{ color }}
          >
            {tool.category}
          </span>
          <ArrowUpRight
            size={15}
            className="text-[var(--text-faint)] transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            style={{ color: "var(--text-faint)" }}
          />
        </div>
      </div>
    </Link>
  );
}
