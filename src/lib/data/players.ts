import type { RawPlayer } from "@/lib/types";
import real from "./players.real.json";

// Real, league-wide NBA dataset — every rostered player, current-season per-game
// stats, real salaries and bios, ingested from ESPN's public APIs by
// scripts/ingest-espn.mjs. Advanced metrics (usage, TS%, PER, BPM, net rating)
// are computed from the real box stats. Re-run the script to refresh.
export const RAW_PLAYERS: RawPlayer[] = real as unknown as RawPlayer[];
