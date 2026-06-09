import { NextResponse } from "next/server";
import { PLAYERS, searchPlayers } from "@/lib/data";

// GET /api/players            → all players
// GET /api/players?q=curry    → search
// GET /api/players?team=LAL   → filter by team
//
// This route is the seam for a real NBA feed: swap the `@/lib/data` source for a
// live provider (nba-api, Sportradar, etc.) and the entire frontend keeps working.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const team = searchParams.get("team");

  let data = PLAYERS;
  if (q) data = searchPlayers(q, 50);
  if (team) data = data.filter((p) => p.team === team.toUpperCase());

  return NextResponse.json({ count: data.length, players: data });
}
