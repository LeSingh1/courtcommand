// Real referee assignments + team free-throw counts for every 2026 playoff
// game already in our shot dataset. Reads the unique gameIds from
// public/shots.playoffs.json, pulls each game's ESPN summary, and records the
// officiating crew plus each team's FTM/FTA from the real box score.
// Run: node scripts/ingest-officials.mjs
import { writeFileSync, readFileSync } from "node:fs";

const H = { "User-Agent": "Mozilla/5.0 CourtCommand/1.0" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// One retry on failure, per spec.
async function getJson(u, tries = 2) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(u, { headers: H });
      if (r.ok) return await r.json();
    } catch {}
    await sleep(400);
  }
  return null;
}

async function main() {
  const shots = JSON.parse(readFileSync("public/shots.playoffs.json", "utf8"));
  const gameIds = [...new Set(shots.map((s) => s.gameId))].sort();
  console.log(`Found ${gameIds.length} unique playoff gameIds.`);

  const games = [];
  let i = 0;
  for (const gid of gameIds) {
    i++;
    const s = await getJson(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${gid}`);
    if (!s) {
      console.log(`  !! ${gid}: summary fetch failed, skipping`);
      continue;
    }
    const officials = (s.gameInfo?.officials || [])
      .map((o) => o.displayName || o.fullName)
      .filter(Boolean);
    const teams = [];
    for (const t of s.boxscore?.teams || []) {
      const abbr = t.team?.abbreviation;
      const stat = (t.statistics || []).find((x) => x.name === "freeThrowsMade-freeThrowsAttempted");
      const m = (stat?.displayValue || "").match(/^(\d+)-(\d+)$/);
      if (!abbr || !m) continue;
      // ESPN lists the away team first, home second; keep homeAway explicit.
      teams.push({ abbr, ftm: Number(m[1]), fta: Number(m[2]), homeAway: t.homeAway });
    }
    if (teams.length === 2 && officials.length) {
      games.push({ gameId: gid, teams, officials });
    } else {
      console.log(`  !! ${gid}: incomplete (teams=${teams.length}, officials=${officials.length}), skipping`);
    }
    if (i % 10 === 0 || i === gameIds.length) console.log(`  …${i}/${gameIds.length} fetched, ${games.length} captured`);
    await sleep(150);
  }

  writeFileSync("src/lib/data/officials.real.json", JSON.stringify(games));
  const refs = new Set(games.flatMap((g) => g.officials));
  console.log(`\nDONE: ${games.length}/${gameIds.length} games, ${refs.size} unique officials.`);
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
