"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { clutchBoard, awardRace } from "@/lib/engine/players";
import { PLAYERS, TEAM_MAP } from "@/lib/data";
import { loadRealShots, realShotChart, shotPlayerIds, type ChartDot } from "@/lib/data/shots";
import { CourtChart } from "@/components/ui/CourtChart";
import { Meter } from "@/components/ui/Meter";
import { gradeColor } from "@/lib/cn";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { TeamLogo } from "@/components/ui/TeamLogo";

export function HomePreviews() {
  const clutch = clutchBoard().slice(0, 5);
  const mvp = awardRace("MVP").slice(0, 5);

  // Real shot-chart teaser: the top playoff scorer's actual attempts.
  const [shotPreview, setShotPreview] = useState<{ name: string; shots: ChartDot[] } | null>(null);
  useEffect(() => {
    let alive = true;
    loadRealShots().then((d) => {
      if (!alive || !d.length) return;
      const ids = shotPlayerIds(d, 30);
      const top = PLAYERS.filter((p) => p.espnId != null && ids.has(p.espnId)).sort((a, b) => b.ppg - a.ppg)[0];
      if (top?.espnId == null) return;
      const chart = realShotChart(d, top.espnId);
      if (chart) setShotPreview({ name: top.name, shots: chart.shots });
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="reveal grid gap-px border border-[var(--line)] bg-[var(--line)] lg:grid-cols-3">
      <PreviewCard href="/tools/clutch" title="Clutch Index" tag="ClutchGene">
        <div className="flex flex-col gap-2.5">
          {clutch.map((r, i) => (
            <div key={r.player.id} className="flex items-center gap-3">
              <span className="stat-num w-4 text-xs text-[var(--text-faint)]">{i + 1}</span>
              <PlayerAvatar player={r.player} size={26} />
              <span className="flex-1 truncate text-sm text-[var(--text)]">{r.player.name}</span>
              <div className="w-16">
                <Meter value={r.clutchScore} color={gradeColor(r.clutchScore)} height={4} />
              </div>
              <span className="stat-num w-7 text-right text-xs font-semibold text-[var(--text-muted)]">
                {r.clutchScore}
              </span>
            </div>
          ))}
        </div>
      </PreviewCard>

      <PreviewCard href="/tools/shot-chart" title="Shot Chart" tag={shotPreview?.name ?? "2026 Playoffs"}>
        <div className="-mx-1">
          {shotPreview ? (
            <CourtChart shots={shotPreview.shots} showShots height={240} />
          ) : (
            <div className="flex h-[240px] items-center justify-center text-xs text-[var(--text-faint)]">
              Loading real playoff shots…
            </div>
          )}
        </div>
      </PreviewCard>

      <PreviewCard href="/tools/award-predictor" title="MVP Race" tag="Award model">
        <div className="flex flex-col gap-3">
          {mvp.map((r) => {
            const team = TEAM_MAP[r.player.team];
            return (
              <div key={r.player.id} className="flex items-center gap-3">
                <PlayerAvatar player={r.player} size={26} />
                <span className="flex-1 truncate text-sm text-[var(--text)]">{r.player.name}</span>
                <TeamLogo abbr={r.player.team} size={18} />
                <span className="stat-num w-10 text-right text-sm font-semibold text-[var(--accent)]">
                  {r.share}%
                </span>
              </div>
            );
          })}
        </div>
      </PreviewCard>
    </div>
  );
}

function PreviewCard({
  href,
  title,
  tag,
  children,
}: {
  href: string;
  title: string;
  tag: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="group block h-full">
      <motion.div
        whileHover={{ y: -4 }}
        whileTap={{ scale: 0.99 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        className="h-full bg-[var(--surface)] p-5 transition-colors hover:bg-[var(--surface-2)]"
      >
        <div className="mb-4 flex items-center justify-between border-b border-[var(--line)] pb-3">
          <div>
            <div className="text-sm font-semibold text-[var(--text)]">{title}</div>
            <div className="kicker mt-1">{tag}</div>
          </div>
          <motion.span
            className="text-[var(--text-faint)] group-hover:text-[var(--accent)]"
            initial={{ x: 0, y: 0 }}
            whileHover={{ x: 2, y: -2 }}
          >
            <ArrowUpRight size={15} />
          </motion.span>
        </div>
        {children}
      </motion.div>
    </Link>
  );
}
