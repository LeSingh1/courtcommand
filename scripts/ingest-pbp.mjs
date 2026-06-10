// Ingest the FULL play-by-play for every 2026 playoff game — not just shots.
// Free throws, turnovers, and clock runoff all move win probability; a curve
// built from made field goals alone misses the free-throw endgames that decide
// close playoff games. Output is compact (one record per event) and served
// from /public at runtime like the shot set.
//
// Usage: node scripts/ingest-pbp.mjs
import { readFileSync, writeFileSync } from "fs";

const SHOTS = JSON.parse(readFileSync("public/shots.playoffs.json", "utf8"));
const gameIds = [...new Set(SHOTS.map((s) => s.gameId))];

const clockToSec = (c) => {
  const m = String(c || "").match(/(\d+):(\d+)/);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : 0;
};

async function fetchSummary(id, attempt = 0) {
  try {
    const r = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${id}`,
    );
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch (e) {
    if (attempt < 1) {
      await new Promise((res) => setTimeout(res, 800));
      return fetchSummary(id, attempt + 1);
    }
    throw e;
  }
}

const out = [];
let done = 0;
for (const id of gameIds) {
  const d = await fetchSummary(id);
  const comps = d?.header?.competitions?.[0]?.competitors ?? [];
  const home = comps.find((c) => c.homeAway === "home");
  const away = comps.find((c) => c.homeAway === "away");
  const homeAbbr = home?.team?.abbreviation ?? "";
  const awayAbbr = away?.team?.abbreviation ?? "";
  const homeTeamId = String(home?.team?.id ?? "");
  const plays = d?.plays ?? [];
  if (!plays.length) {
    console.warn(`no plays for ${id}`);
    continue;
  }
  const events = [];
  for (const p of plays) {
    const period = p?.period?.number ?? 0;
    if (!period) continue;
    const teamId = String(p?.team?.id ?? "");
    const typeText = (p?.type?.text ?? "").toLowerCase();
    events.push({
      p: period,
      c: clockToSec(p?.clock?.displayValue),
      h: p?.homeScore ?? 0,
      a: p?.awayScore ?? 0,
      // which side acted: 1 home, 0 away, -1 neutral (period markers etc.)
      t: teamId ? (teamId === homeTeamId ? 1 : 0) : -1,
      // event class: s=score, f=free throw, o=turnover, e=other
      k: p?.scoringPlay
        ? typeText.includes("free throw")
          ? "f"
          : "s"
        : typeText.includes("turnover") || typeText.includes("lost ball")
          ? "o"
          : "e",
      v: p?.scoreValue ?? 0,
    });
  }
  out.push({ gameId: id, home: homeAbbr, away: awayAbbr, events });
  done++;
  process.stdout.write(`\r${done}/${gameIds.length} games`);
  await new Promise((res) => setTimeout(res, 150));
}

writeFileSync("public/pbp.playoffs.json", JSON.stringify(out));
const totalEvents = out.reduce((acc, g) => acc + g.events.length, 0);
console.log(
  `\nwrote public/pbp.playoffs.json — ${out.length} games, ${totalEvents} events, ` +
    `${Math.round(JSON.stringify(out).length / 1024)} KB`,
);
