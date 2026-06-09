import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { clutchBoard, awardRace } from "@/lib/engine/players";
import { shotChart } from "@/lib/engine/game";
import { getPlayer, getPlayerByName, TEAM_MAP } from "@/lib/data";
import { CourtChart } from "@/components/ui/CourtChart";
import { Meter } from "@/components/ui/Meter";
import { gradeColor } from "@/lib/cn";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { TeamLogo } from "@/components/ui/TeamLogo";

export function HomePreviews() {
  const clutch = clutchBoard().slice(0, 5);
  const mvp = awardRace("MVP").slice(0, 5);
  const curry = getPlayerByName("Stephen Curry")!;
  const chart = shotChart(curry);

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

      <PreviewCard href="/tools/shot-chart" title="Shot Chart" tag={curry.name}>
        <div className="-mx-1">
          <CourtChart shots={chart.shots} showShots height={240} />
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
    <Link href={href} className="group block h-full bg-[var(--surface)] p-5 transition-colors hover:bg-[var(--surface-2)]">
        <div className="mb-4 flex items-center justify-between border-b border-[var(--line)] pb-3">
          <div>
            <div className="text-sm font-semibold text-[var(--text)]">{title}</div>
            <div className="kicker mt-1">{tag}</div>
          </div>
          <ArrowUpRight size={15} className="text-[var(--text-faint)] transition group-hover:text-[var(--accent)]" />
        </div>
        {children}
      </Link>
  );
}
