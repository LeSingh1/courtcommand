"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Scale } from "lucide-react";
import { spring } from "@/lib/motion";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { Segmented } from "@/components/ui/Controls";
import { Meter, Diverging } from "@/components/ui/Meter";
import { Reveal } from "@/components/ui/Reveal";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { getTool } from "@/lib/tools";
import { refBiasBoard } from "@/lib/engine/game";
import { TEAM_MAP } from "@/lib/data";
import { gradeColor } from "@/lib/cn";

const CYAN = "#7E8CA0";

type SortKey = "homeWhistle" | "starWhistle" | "foulDiff";

export default function RefBiasPage() {
  const tool = getTool("ref-bias")!;
  const [sort, setSort] = useState<SortKey>("homeWhistle");

  const board = useMemo(() => refBiasBoard(), []);

  const withGap = useMemo(
    () =>
      board.map((r) => ({
        ...r,
        homeGap: Math.round((r.homeFtRate - r.awayFtRate) * 10) / 10,
      })),
    [board],
  );

  const sorted = useMemo(() => {
    const key =
      sort === "homeWhistle"
        ? (r: (typeof withGap)[number]) => r.homeGap
        : sort === "starWhistle"
          ? (r: (typeof withGap)[number]) => r.starWhistle
          : (r: (typeof withGap)[number]) => r.foulDiff;
    return [...withGap].sort((a, b) => key(b) - key(a));
  }, [withGap, sort]);

  // team with the biggest home-vs-away FT gap
  const biggestGap = useMemo(
    () => [...withGap].sort((a, b) => b.homeGap - a.homeGap)[0],
    [withGap],
  );

  const leagueHomeGap = useMemo(
    () => Math.round((withGap.reduce((a, r) => a + r.homeGap, 0) / withGap.length) * 10) / 10,
    [withGap],
  );

  const gapTeam = TEAM_MAP[biggestGap.team];

  return (
    <ToolShell tool={tool}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Insight accent={CYAN}>
          League-wide, home teams average <b>+{leagueHomeGap} free throws</b> per game over visitors —
          a measurable home-whistle tilt. <b>{gapTeam?.city} {gapTeam?.name}</b> draw the most one-sided
          home advantage at <b>+{biggestGap.homeGap} FT/game</b>.
        </Insight>
        <Segmented
          accent={CYAN}
          value={sort}
          onChange={setSort}
          options={[
            { label: "Home Whistle", value: "homeWhistle" },
            { label: "Star Whistle", value: "starWhistle" },
            { label: "Foul Diff", value: "foulDiff" },
          ]}
        />
      </div>

      <AnimatePresence mode="wait">
      <motion.div
        key={sort}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={spring.soft}
      >
      {/* spotlight cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {sorted.slice(0, 3).map((r, i) => {
          const team = TEAM_MAP[r.team];
          const val = sort === "homeWhistle" ? r.homeGap : sort === "starWhistle" ? r.starWhistle : r.foulDiff;
          return (
            <Reveal key={r.team} delay={i * 0.08}>
              <motion.div
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.97 }}
                transition={spring.snappy}
                className="glass relative overflow-hidden rounded-none p-5"
              >
                <div className="flex items-center justify-between">
                  <span className="display text-4xl text-white/15">#{i + 1}</span>
                  <Scale size={20} style={{ color: CYAN }} />
                </div>
                <div className="mt-2 flex items-center gap-2.5">
                  <TeamLogo abbr={r.team} size={32} />
                  <span className="font-semibold text-white">
                    {team?.city} {team?.name}
                  </span>
                </div>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <div className="stat-num text-3xl font-bold" style={{ color: CYAN }}>
                      {val > 0 && sort !== "starWhistle" ? "+" : ""}
                      {val}
                    </div>
                    <div className="text-[10px] uppercase tracking-wide text-white/40">
                      {sort === "homeWhistle"
                        ? "Home FT edge"
                        : sort === "starWhistle"
                          ? "Star whistle"
                          : "Foul diff / game"}
                    </div>
                  </div>
                  <div className="stat-num text-right text-xs text-white/50">
                    <div>{r.homeFtRate} home FT</div>
                    <div>{r.awayFtRate} away FT</div>
                  </div>
                </div>
              </motion.div>
            </Reveal>
          );
        })}
      </div>

      <Panel title="Officiating tendency board">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wide text-white/40">
                <th className="py-2 pl-2 font-medium">Team</th>
                <th className="py-2 text-right font-medium">Home FT</th>
                <th className="py-2 text-right font-medium">Away FT</th>
                <th className="py-2 font-medium">Foul Diff</th>
                <th className="py-2 font-medium">Star Whistle</th>
                <th className="py-2 pr-2 text-right font-medium">Home Edge</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const team = TEAM_MAP[r.team];
                const isFlag = r.team === biggestGap.team;
                return (
                  <tr
                    key={r.team}
                    className="border-b border-white/[0.04] transition hover:bg-white/[0.03]"
                    style={isFlag ? { background: `${CYAN}12` } : undefined}
                  >
                    <td className="py-2.5 pl-2">
                      <div className="flex items-center gap-2.5">
                        <TeamLogo abbr={r.team} size={26} />
                        <span className="text-white/85">
                          {team?.city} {team?.name}
                        </span>
                        {isFlag && (
                          <span
                            className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
                            style={{ background: `${CYAN}22`, color: CYAN }}
                          >
                            Biggest tilt
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="stat-num py-2.5 text-right text-white/75">{r.homeFtRate}</td>
                    <td className="stat-num py-2.5 text-right text-white/55">{r.awayFtRate}</td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-24">
                          <Diverging value={r.foulDiff} range={6} color="#5FA97E" negColor="#BF5B4E" />
                        </div>
                        <span
                          className="stat-num w-9 text-xs font-semibold"
                          style={{ color: r.foulDiff >= 0 ? "#5FA97E" : "#BF5B4E" }}
                        >
                          {r.foulDiff > 0 ? "+" : ""}
                          {r.foulDiff}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-16">
                          <Meter value={r.starWhistle} max={8} color={gradeColor((r.starWhistle / 8) * 100)} height={6} />
                        </div>
                        <span className="stat-num w-7 text-xs text-white/65">{r.starWhistle}</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-2 text-right">
                      <span
                        className="stat-num rounded-none px-2 py-0.5 text-xs font-bold"
                        style={{ background: `${CYAN}1f`, color: CYAN }}
                      >
                        +{r.homeGap}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      </motion.div>
      </AnimatePresence>
    </ToolShell>
  );
}
