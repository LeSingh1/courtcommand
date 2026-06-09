import { NextResponse } from "next/server";
import { awardRace, type AwardKind } from "@/lib/engine/players";

const VALID: AwardKind[] = ["MVP", "DPOY", "ROTY", "6MOY"];

// GET /api/awards?kind=MVP    → award race projection
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const kind = (searchParams.get("kind") ?? "MVP").toUpperCase() as AwardKind;
  if (!VALID.includes(kind)) {
    return NextResponse.json({ error: `kind must be one of ${VALID.join(", ")}` }, { status: 400 });
  }
  return NextResponse.json({ award: kind, race: awardRace(kind) });
}
