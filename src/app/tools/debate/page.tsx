"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MessagesSquare, Check } from "lucide-react";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { PlayerPicker } from "@/components/ui/PlayerPicker";
import { Diverging } from "@/components/ui/Meter";
import { Segmented, Badge } from "@/components/ui/Controls";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { getTool } from "@/lib/tools";
import { getPlayer, getPlayerByName } from "@/lib/data";
import { debate } from "@/lib/engine/content";
import type { Player } from "@/lib/types";

const GOLD = "#C9A14A";
type Lens = "overall" | "offense" | "defense";

export default function DebatePage() {
  return (
    <Suspense fallback={null}>
      <DebateInner />
    </Suspense>
  );
}

function DebateInner() {
  const tool = getTool("debate")!;
  const params = useSearchParams();
  const [a, setA] = useState<Player | null>(() => getPlayerByName("Anthony Edwards") ?? null);
  const [b, setB] = useState<Player | null>(() => getPlayerByName("Luka Doncic") ?? null);
  const [lens, setLens] = useState<Lens>("overall");

  useEffect(() => {
    const pa = params.get("a");
    const pb = params.get("b");
    if (pa) {
      const p = getPlayer(pa);
      if (p) setA(p);
    }
    if (pb) {
      const p = getPlayer(pb);
      if (p) setB(p);
    }
  }, [params]);

  const result = useMemo(() => (a && b ? debate(a.id, b.id, lens) : null), [a, b, lens]);

  return (
    <ToolShell tool={tool}>
      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_auto_1fr]">
        <PlayerPicker value={a} onChange={setA} accent={GOLD} exclude={b ? [b.id] : []} placeholder="Side A…" />
        <div className="flex items-center justify-center">
          <Segmented
            accent={GOLD}
            value={lens}
            onChange={setLens}
            options={[
              { label: "Overall", value: "overall" },
              { label: "Offense", value: "offense" },
              { label: "Defense", value: "defense" },
            ]}
          />
        </div>
        <PlayerPicker value={b} onChange={setB} accent="#7E8CA0" exclude={a ? [a.id] : []} placeholder="Side B…" />
      </div>

      {!result ? (
        <Panel className="flex min-h-[300px] flex-col items-center justify-center text-center">
          <MessagesSquare size={40} className="mb-4 text-[#C9A14A]" />
          <p className="max-w-xs text-sm text-white/50">
            Pick two players and a lens — the engine builds an evidence-backed case for each side and
            calls the edge by the numbers.
          </p>
        </Panel>
      ) : (
        <>
          <div className="grid items-stretch gap-4 lg:grid-cols-[1fr_120px_1fr]">
            <DebateCard side={result.a} accent={GOLD} leading={result.edge > 0} />

            <div className="flex flex-col items-center justify-center gap-3">
              <div className="text-[10px] uppercase tracking-widest text-white/40">Edge</div>
              <div
                className="stat-num text-3xl font-bold"
                style={{ color: result.edge >= 0 ? GOLD : "#7E8CA0" }}
              >
                {result.edge > 0 ? "+" : ""}
                {result.edge}
              </div>
              <div className="w-full px-1">
                <Diverging value={result.edge} range={100} color={GOLD} negColor="#7E8CA0" />
              </div>
              <div className="flex w-full justify-between text-[9px] text-white/35">
                <span className="truncate">{result.a.player.name.split(" ").slice(-1)}</span>
                <span className="truncate">{result.b.player.name.split(" ").slice(-1)}</span>
              </div>
            </div>

            <DebateCard side={result.b} accent="#7E8CA0" leading={result.edge < 0} />
          </div>

          <div className="mt-6">
            <Insight accent={GOLD}>
              <b>Verdict:</b> {result.verdict}
            </Insight>
          </div>
        </>
      )}
    </ToolShell>
  );
}

function DebateCard({
  side,
  accent,
  leading,
}: {
  side: { player: Player; points: string[] };
  accent: string;
  leading: boolean;
}) {
  return (
    <div
      className="glass rounded-none p-5"
      style={{ boxShadow: leading ? `inset 0 0 0 1px ${accent}44` : undefined }}
    >
      <div className="mb-4 flex items-center gap-3">
        <PlayerAvatar player={side.player} size={44} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-white">{side.player.name}</div>
          <div className="stat-num text-[11px] text-white/45">
            {side.player.pos} · {side.player.ppg}/{side.player.rpg}/{side.player.apg}
          </div>
        </div>
        {leading && <Badge color={accent}>Edge</Badge>}
      </div>
      <div className="space-y-2.5">
        {side.points.map((pt, i) => (
          <div
            key={i}
            className="flex items-start gap-2.5 text-sm leading-relaxed text-white/75"
          >
            <Check size={15} className="mt-0.5 shrink-0" style={{ color: accent }} />
            <span>{pt}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
