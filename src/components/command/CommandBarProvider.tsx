"use client";

import { createContext, useContext, useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Command, CornerDownLeft, Search, X } from "lucide-react";
import { routeCommand, EXAMPLE_QUERIES } from "@/lib/engine/command";
import { TOOLS } from "@/lib/tools";
import { ACCENT } from "@/lib/cn";
import { getIcon } from "@/components/ui/icon";

interface Ctx {
  open: () => void;
  close: () => void;
}
const CommandCtx = createContext<Ctx>({ open: () => {}, close: () => {} });
export const useCommandBar = () => useContext(CommandCtx);

export function CommandBarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [q, setQ] = useState("");
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((o) => !o);
      }
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const matches = useMemo(() => routeCommand(q), [q]);
  const fallback = useMemo(
    () =>
      q.trim()
        ? TOOLS.filter((t) => t.name.toLowerCase().includes(q.toLowerCase())).slice(0, 4)
        : [],
    [q],
  );

  const go = (href: string) => {
    setIsOpen(false);
    setQ("");
    router.push(href);
  };

  return (
    <CommandCtx.Provider value={{ open: () => setIsOpen(true), close: () => setIsOpen(false) }}>
      {children}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-start justify-center bg-black/70 px-4 pt-[12vh] backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, y: -12, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.96, y: -12, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong w-full max-w-2xl overflow-hidden"
            >
              <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3.5">
                <Search size={18} className="text-[var(--text-faint)]" strokeWidth={1.75} />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const top = matches[0] ?? (fallback[0] ? { href: `/tools/${fallback[0].slug}` } : null);
                      if (top) go(top.href);
                    }
                  }}
                  placeholder="Ask anything… “Find underrated 3&D wings under $15M”"
                  className="flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/35"
                />
                <kbd className="hidden items-center gap-1 rounded-none border border-white/15 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/45 sm:flex">
                  ESC
                </kbd>
                <button onClick={() => setIsOpen(false)} className="text-white/40 hover:text-white">
                  <X size={16} />
                </button>
              </div>

              <div className="max-h-[52vh] overflow-y-auto p-2">
                {!q.trim() && (
                  <div className="p-2">
                    <div className="eyebrow mb-2 px-2 text-white/35">Try asking</div>
                    <div className="flex flex-col gap-1">
                      {EXAMPLE_QUERIES.map((ex) => (
                        <button
                          key={ex}
                          onClick={() => setQ(ex)}
                          className="flex items-center gap-2.5 rounded-none px-2.5 py-2 text-left text-sm text-white/65 transition hover:bg-white/[0.06] hover:text-white"
                        >
                          <Search size={14} className="text-white/30" />
                          {ex}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {q.trim() && matches.length > 0 && (
                  <div className="p-1">
                    <div className="eyebrow mb-1 px-2.5 text-white/35">Routed tools</div>
                    {matches.map((m, i) => {
                      const accent = ACCENT[m.tool.accent];
                      const Icon = getIcon(m.tool.icon);
                      return (
                        <button
                          key={m.tool.slug}
                          onClick={() => go(m.href)}
                          className="group flex w-full items-center gap-3 rounded-none px-2.5 py-2.5 text-left transition hover:bg-white/[0.06]"
                        >
                          <div
                            className="flex h-9 w-9 items-center justify-center rounded-none"
                            style={{ background: `${accent.hex}22`, color: accent.hex }}
                          >
                            <Icon size={17} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-white">{m.tool.name}</span>
                              {i === 0 && (
                                <span
                                  className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase"
                                  style={{ background: `${accent.hex}22`, color: accent.hex }}
                                >
                                  Best match
                                </span>
                              )}
                            </div>
                            <div className="truncate text-xs text-white/45">{m.reason}</div>
                          </div>
                          <div className="stat-num text-xs text-white/35">{m.confidence}%</div>
                          <CornerDownLeft size={14} className="text-white/20 group-hover:text-white/60" />
                        </button>
                      );
                    })}
                  </div>
                )}

                {q.trim() && matches.length === 0 && fallback.length > 0 && (
                  <div className="p-1">
                    {fallback.map((t) => (
                      <button
                        key={t.slug}
                        onClick={() => go(`/tools/${t.slug}`)}
                        className="flex w-full items-center gap-3 rounded-none px-2.5 py-2.5 text-left hover:bg-white/[0.06]"
                      >
                        <span className="text-sm text-white">{t.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {q.trim() && matches.length === 0 && fallback.length === 0 && (
                  <div className="px-4 py-8 text-center text-sm text-white/40">
                    No route found — try a player name, “trade”, “clutch”, or “underrated”.
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-white/10 px-4 py-2.5 text-[11px] text-white/35">
                <span className="flex items-center gap-1.5">
                  <Command size={11} /> Command bar routes natural language to 30 tools
                </span>
                <span className="flex items-center gap-1">
                  <CornerDownLeft size={11} /> to open
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </CommandCtx.Provider>
  );
}
