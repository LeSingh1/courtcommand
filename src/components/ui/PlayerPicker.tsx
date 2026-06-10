"use client";

import { useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { PLAYERS } from "@/lib/data";
import type { Player } from "@/lib/types";
import { TEAM_MAP } from "@/lib/data";
import { cn } from "@/lib/cn";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";

export function PlayerPicker({
  value,
  onChange,
  placeholder = "Search a player…",
  exclude = [],
  accent = "#E9A23B",
  ariaLabel,
  pool: poolProp,
}: {
  value?: Player | null;
  onChange: (p: Player | null) => void;
  placeholder?: string;
  exclude?: string[];
  accent?: string;
  ariaLabel?: string;
  /** Optional candidate pool; defaults to the full player set. */
  pool?: Player[];
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    const pool = (poolProp ?? PLAYERS).filter((p) => !exclude.includes(p.id));
    if (!s) return pool.slice(0, 8);
    return pool
      .filter((p) => p.name.toLowerCase().includes(s) || p.team.toLowerCase().includes(s))
      .slice(0, 8);
  }, [q, exclude, poolProp]);

  if (value) {
    const team = TEAM_MAP[value.team];
    return (
      <div
        className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5"
        style={{ boxShadow: `inset 0 0 0 1px ${accent}22` }}
      >
        <PlayerAvatar player={value} size={38} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-white">{value.name}</div>
          <div className="stat-num text-[11px] text-white/45">
            {value.pos} · {value.ppg} PPG · {value.archetype}
          </div>
        </div>
        <button
          onClick={() => onChange(null)}
          className="rounded-lg p-1 text-white/40 transition hover:bg-white/10 hover:text-white"
          aria-label="Clear"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 focus-within:border-white/25">
        <Search size={16} className="text-white/40" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel ?? placeholder}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") setActive((a) => Math.min(results.length - 1, a + 1));
            if (e.key === "ArrowUp") setActive((a) => Math.max(0, a - 1));
            if (e.key === "Enter" && results[active]) {
              onChange(results[active]);
              setQ("");
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35"
        />
      </div>
      {open && results.length > 0 && (
        <div className="glass-strong absolute z-30 mt-2 max-h-72 w-full overflow-auto p-1">
          {results.map((p, i) => {
            const team = TEAM_MAP[p.team];
            return (
              <button
                key={p.id}
                onMouseDown={() => {
                  onChange(p);
                  setQ("");
                  setOpen(false);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition",
                  i === active ? "bg-white/[0.08]" : "hover:bg-white/[0.05]",
                )}
              >
                <PlayerAvatar player={p} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-white">{p.name}</div>
                  <div className="stat-num text-[10px] text-white/40">
                    {p.pos} · {p.ppg}/{p.rpg}/{p.apg}
                  </div>
                </div>
                <div className="stat-num text-[11px] text-white/45">{p.archetype}</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
