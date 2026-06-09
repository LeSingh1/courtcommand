import { NextResponse } from "next/server";
import { getPlayer } from "@/lib/data";
import { similarPlayers, scoutingReport } from "@/lib/engine/players";

// GET /api/players/:id        → full player profile + similar comps + scouting report
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const player = getPlayer(id);
  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }
  return NextResponse.json({
    player,
    similar: similarPlayers(id, 6),
    scouting: scoutingReport(id),
  });
}
