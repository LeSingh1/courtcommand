import type { Player, RawPlayer, Position } from "@/lib/types";
import { RAW_PLAYERS } from "./players";
import { TEAMS, TEAM_MAP } from "./teams";
export { headshotUrl, teamLogoUrl, initials } from "./headshots";

export { TEAMS, TEAM_MAP } from "./teams";
export {
  SALARY_CAP,
  LUXURY_TAX,
  FIRST_APRON,
  SECOND_APRON,
} from "./teams";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const r1 = (v: number) => Math.round(v * 10) / 10;

function derive(rp: RawPlayer): Player {
  const { pos, ppg, tsp, tpa, fgp, ftp, usg, bpm, age, mpg, gp, rpg, apg, spg, bpg, per, htIn } = rp;

  // ---- shot profile ----
  const estFGA = Math.max(6, (ppg / (2 * tsp)) * 0.85);
  const three = clamp(tpa / estFGA, 0.02, 0.82);
  const interior = 1 - three;
  const rimBias =
    pos === "C" ? 0.78 : pos === "PF" ? 0.62 : pos === "SF" ? 0.5 : pos === "SG" ? 0.42 : 0.45;
  const shotRim = r2(interior * rimBias);
  const shotMid = r2(interior * (1 - rimBias));
  const shotThree = r2(three);

  // ---- composites ----
  const starPower = clamp(
    (per - 10) * 2.2 + bpm * 2.4 + (ppg - 10) * 1.1 + (usg - 18) * 0.6 + 20,
    5,
    100,
  );
  const efficiency = clamp((tsp - 0.5) * 320 + (bpm) * 1.5 + 40, 5, 100);

  const offImpact = clamp(
    (ppg - 8) * 1.4 + apg * 2.4 + (tsp - 0.55) * 120 + bpm * 1.8 + 28,
    5,
    100,
  );
  const defImpact = clamp(
    spg * 9 + bpg * 11 + (pos === "C" ? 16 : pos === "PF" ? 12 : 6) + rpg * 1.1 + rp.netRtg * 0.6,
    5,
    100,
  );

  // ---- defensive / offensive ratings ----
  const ortg = clamp(102 + bpm * 1.1 + (tsp - 0.55) * 70, 95, 128);
  const drtg = clamp(118 - defImpact * 0.11 - bpm * 0.3, 104, 120);

  // ---- clutch ----
  const poise = clamp(0.8 + (ftp - 0.78) * 0.9 - (usg - 25) * 0.004, 0.7, 1.05);
  const clutchFgp = r2(clamp(fgp * poise + 0.01, 0.34, 0.6));
  const clutchUsg = r1(clamp(usg + (starPower > 72 ? 3.2 : starPower > 55 ? 1.2 : -0.5), 12, 42));
  const clutchPpg = r1(ppg * 0.155 * (0.82 + (poise - 0.8)));

  // ---- rebounding split ----
  const defReb = r1(rpg * (pos === "C" ? 0.76 : pos === "PF" ? 0.7 : pos === "SF" ? 0.62 : 0.56));

  // ---- injury risk ----
  const missed = Math.max(0, 82 - gp);
  const injuryRisk = clamp(
    (age - 24) * 2.4 + missed * 1.3 + (mpg - 30) * 1.0 + (rp.wtLb / htIn - 2.7) * 14 + 18,
    6,
    96,
  );

  const archetype = classifyArchetype(rp, { shotThree, defImpact, offImpact });

  return {
    ...rp,
    shotRim,
    shotMid,
    shotThree,
    clutchPpg,
    clutchFgp,
    clutchUsg,
    defReb,
    defImpact: r1(defImpact),
    offImpact: r1(offImpact),
    injuryRisk: r1(injuryRisk),
    ortg: r1(ortg),
    drtg: r1(drtg),
    archetype,
    starPower: r1(starPower),
    efficiency: r1(efficiency),
  };
}

function r2(v: number) {
  return Math.round(v * 100) / 100;
}

function classifyArchetype(
  rp: RawPlayer,
  d: { shotThree: number; defImpact: number; offImpact: number },
): string {
  const { pos, apg, usg, bpg, ppg, tpp, spg } = rp;
  if (pos === "C" && bpg >= 1.3 && d.defImpact > 55) return "Rim Protector";
  if (pos === "C" && rp.apg >= 5) return "Playmaking Big";
  if ((pos === "C" || pos === "PF") && d.shotThree > 0.3 && tpp >= 0.36) return "Stretch Big";
  if (apg >= 7.5 && usg >= 26) return "Primary Creator";
  if (apg >= 6) return "Secondary Playmaker";
  if (usg >= 29 && ppg >= 24) return "Volume Scorer";
  if (d.shotThree >= 0.45 && tpp >= 0.36 && d.defImpact >= 45) return "3 and D Wing";
  if (d.shotThree >= 0.45 && tpp >= 0.37) return "Floor Spacer";
  if (spg >= 1.4 && d.defImpact >= 50) return "Perimeter Stopper";
  if (ppg >= 18 && usg >= 24) return "Slasher";
  if (pos === "PG" || pos === "SG") return "Combo Guard";
  return "Connector";
}

export const PLAYERS: Player[] = RAW_PLAYERS.map(derive);

export const PLAYER_MAP: Record<string, Player> = Object.fromEntries(
  PLAYERS.map((p) => [p.id, p]),
);

export function getPlayer(id: string): Player | undefined {
  return PLAYER_MAP[id];
}

const NAME_MAP: Record<string, Player> = Object.fromEntries(
  PLAYERS.map((p) => [p.name.toLowerCase(), p]),
);

// Resolve a player by full name (used for featured defaults). Falls back to a
// fuzzy contains match, then to the highest-scoring player so the UI is never empty.
export function getPlayerByName(name: string): Player | undefined {
  const s = name.toLowerCase();
  return (
    NAME_MAP[s] ||
    PLAYERS.find((p) => p.name.toLowerCase().includes(s)) ||
    PLAYERS.slice().sort((a, b) => b.starPower - a.starPower)[0]
  );
}

export function featuredPlayers(n = 1): Player[] {
  return PLAYERS.slice().sort((a, b) => b.starPower - a.starPower).slice(0, n);
}

export function searchPlayers(q: string, limit = 8): Player[] {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  return PLAYERS.filter(
    (p) => p.name.toLowerCase().includes(s) || p.team.toLowerCase().includes(s),
  ).slice(0, limit);
}

export function playersByTeam(abbr: string): Player[] {
  return PLAYERS.filter((p) => p.team === abbr);
}

export const POSITIONS: Position[] = ["PG", "SG", "SF", "PF", "C"];
