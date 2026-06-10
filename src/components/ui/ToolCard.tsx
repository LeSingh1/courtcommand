"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import type { ToolMeta } from "@/lib/types";
import { getIcon } from "@/components/ui/icon";
import { categoryColor } from "@/lib/tools";
import { spring } from "@/lib/motion";

// Court Mono: the card itself is achromatic — elevation and type carry the
// design. Category color appears only as a 6px wayfinding dot by the label,
// so thirty cards in a grid read as one calm surface instead of a quilt.
export function ToolCard({ tool, index = 0 }: { tool: ToolMeta; index?: number }) {
  const Icon = getIcon(tool.icon);
  const num = String(index + 1).padStart(2, "0");
  const color = categoryColor(tool.category);

  return (
    <Link href={`/tools/${tool.slug}`} className="reveal group block h-full">
      <motion.div
        initial="rest"
        whileHover="hover"
        whileTap={{ scale: 0.99 }}
        animate="rest"
        variants={{ rest: { y: 0 }, hover: { y: -4 } }}
        transition={spring.snappy}
        className="relative flex h-full flex-col rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 transition-colors duration-200 group-hover:border-[var(--line-strong)] group-hover:bg-[var(--surface-2)]"
      >
        <div className="relative mb-5 flex items-start justify-between">
          <motion.div
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--line)] text-[var(--text-muted)] transition-colors group-hover:text-[var(--text)]"
            variants={{ rest: { scale: 1, rotate: 0 }, hover: { scale: 1.08, rotate: -3 } }}
            transition={spring.snappy}
          >
            <Icon size={18} strokeWidth={1.75} />
          </motion.div>
          <span className="scoreboard text-xl text-[var(--text-faint)] opacity-60">{num}</span>
        </div>
        <h3 className="relative font-semibold tracking-tight text-[var(--text)]">{tool.name}</h3>
        <p className="relative mt-1.5 text-[13px] leading-relaxed text-[var(--text-muted)]">{tool.tagline}</p>
        <div className="relative mt-auto flex items-center justify-between border-t border-[var(--line)] pt-4">
          <span className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: color }} />
            {tool.category}
          </span>
          <motion.span
            className="text-[var(--text-faint)]"
            variants={{ rest: { x: 0, y: 0, opacity: 0.7 }, hover: { x: 2, y: -2, opacity: 1 } }}
            transition={spring.snappy}
          >
            <ArrowUpRight size={15} />
          </motion.span>
        </div>
      </motion.div>
    </Link>
  );
}
