"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import type { ToolMeta } from "@/lib/types";
import { getIcon } from "@/components/ui/icon";
import { categoryColor } from "@/lib/tools";
import { spring } from "@/lib/motion";

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
        variants={{ rest: { y: 0 }, hover: { y: -5 } }}
        transition={spring.snappy}
        className="relative flex h-full flex-col overflow-hidden border border-[var(--line)] bg-[var(--surface)] p-5"
        style={{ ["--cat" as string]: color }}
      >
        {/* category accent rule — visible at rest, brightens on hover */}
        <motion.span
          className="absolute inset-x-0 top-0 h-px"
          style={{ background: color }}
          variants={{ rest: { opacity: 0.35 }, hover: { opacity: 1 } }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        />
        <div className="relative mb-5 flex items-start justify-between">
          <motion.div
            className="flex h-10 w-10 items-center justify-center border"
            style={{ borderColor: `${color}40`, color }}
            variants={{ rest: { scale: 1, rotate: 0 }, hover: { scale: 1.1, rotate: -4 } }}
            transition={spring.snappy}
          >
            <Icon size={18} strokeWidth={1.75} />
          </motion.div>
          <span className="scoreboard text-xl text-[var(--text-faint)]">{num}</span>
        </div>
        <h3 className="relative font-semibold tracking-tight text-[var(--text)] transition-colors group-hover:text-white">
          {tool.name}
        </h3>
        <p className="relative mt-1.5 text-[13px] leading-relaxed text-[var(--text-muted)]">{tool.tagline}</p>
        <div className="relative mt-auto flex items-center justify-between border-t border-[var(--line)] pt-4">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color }}>
            {tool.category}
          </span>
          <motion.span
            className="text-[var(--text-faint)]"
            variants={{ rest: { x: 0, y: 0, color: "var(--text-faint)" }, hover: { x: 2, y: -2, color } }}
            transition={spring.snappy}
          >
            <ArrowUpRight size={15} />
          </motion.span>
        </div>
      </motion.div>
    </Link>
  );
}
