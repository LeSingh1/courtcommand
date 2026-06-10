// Exhaustive 2026 playoff shot ingestion — pulls EVERY shooting play by EVERY
// player across EVERY completed playoff game from ESPN play-by-play. No caps,
// no roster filter, no minimum. Feeds the Shot Quality "Real shots" mode so it
// covers the whole postseason. Run: node scripts/ingest-playoff-shots.mjs
import { writeFileSync, readFileSync } from "node:fs";

const ROSTER = JSON.parse(readFileSync("src/lib/data/players.real.json", "utf8"));
const ROSTER_IDS = new Set(ROSTER.map((p) => Number(p.espnId)));

const H = { "User-Agent": "Mozilla/5.0 CourtCommand/1.0" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJson(u, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(u, { headers: H });
      if (r.ok) return await r.json();
    } catch {}
    await sleep(350 * (i + 1));
  }
  return null;
}

const ymd = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
const SENTINEL = (v) => v == null || Math.abs(v) > 1000;

function modelShotType(dist, typeText, text) {
  const t = `${typeText || ""} ${text || ""}`.toLowerCase();
  const three = /three|3-?pt|3 point/.test(t);
  if (three) {
    if (/step ?back|stepback/.test(t)) return "stepback3";
    if (/pull|driving|turnaround|fade|running/.test(t)) return "pullup3";
    return "catch3";
  }
  if (dist <= 4 || /dunk|layup|alley|tip|hook|cutting|putback/.test(t)) return "rim";
  if (dist <= 9 || /float|runner/.test(t)) return "floater";
  return "midrange";
}

async function main() {
  // collect EVERY completed playoff game across the 2026 postseason window
  const start = new Date(2026, 3, 14); // Apr 14 (play-in onward)
  const end = new Date(2026, 5, 9); // Jun 9
  const games = []; // {id, seasonType}
  const seen = new Set();
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const sb = await getJson(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${ymd(d)}`);
    for (const e of sb?.events || []) {
      if (!e?.status?.type?.completed) continue;
      const st = e?.season?.type;
      if (st !== 3 && st !== 5) continue; // 3 = playoffs, 5 = play-in
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      games.push(e.id);
    }
    await sleep(60);
  }
  console.log(`Collected ${games.length} completed playoff/play-in games (2026).`);

  const shots = [];
  let g = 0;
  for (const gid of games) {
    g++;
    const s = await getJson(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${gid}`);
    if (!s) continue;
    const comp = s.header?.competitions?.[0];
    const gameName = comp?.competitors?.map((c) => c.team?.abbreviation).join(" vs ") || gid;
    const date = comp?.date;
    const round = s.header?.season?.type === 3 ? "Playoffs" : "Play-In";
    // athlete id -> { name, team } from the boxscore (plays use $refs, not names)
    const idMap = {};
    for (const tb of s.boxscore?.players || []) {
      const abbr = tb.team?.abbreviation;
      for (const stat of tb.statistics || []) {
        for (const a of stat.athletes || []) {
          if (a.athlete?.id) idMap[a.athlete.id] = { name: a.athlete.displayName, team: abbr };
        }
      }
    }
    let gameShots = 0;
    for (const p of s.plays || []) {
      if (!p.shootingPlay) continue;
      const c = p.coordinate;
      if (!c || SENTINEL(c.x) || SENTINEL(c.y)) continue;
      const ath = p.participants?.[0]?.athlete;
      if (!ath?.id) continue;
      const info = idMap[ath.id] || {};
      const text = p.text || "";
      const distM = text.match(/(\d+)-foot/);
      const dist = distM ? parseInt(distM[1], 10) : c.y <= 3 ? 2 : Math.round(c.y);
      const made = !!p.scoringPlay;
      const value = p.scoreValue || (/(three|3 point)/i.test(text) ? 3 : 2);
      const courtX = Math.round((c.x / 50) * 480 + 10);
      const courtY = Math.round(52 + (c.y / 47) * 408);
      shots.push({
        id: `${gid}-${p.id}`,
        espnId: Number(ath.id),
        player: info.name || ath.displayName || "",
        team: info.team || "",
        gameId: gid,
        game: gameName,
        date,
        period: p.period?.number,
        clock: p.clock?.displayValue,
        dist,
        value,
        made,
        assisted: /assists\)/.test(text),
        shotType: modelShotType(dist, p.type?.text, text),
        typeText: p.type?.text || "",
        text,
        x: Math.max(12, Math.min(488, courtX)),
        y: Math.max(40, Math.min(360, courtY)),
      });
      gameShots++;
    }
    if (g % 10 === 0 || g === games.length) console.log(`  …${g}/${games.length} games, ${shots.length} shots`);
    await sleep(120);
  }

  // keep EVERY shot. sort by player, then chronological.
  shots.sort((a, b) =>
    a.player < b.player ? -1 : a.player > b.player ? 1 : (a.date || "").localeCompare(b.date || ""),
  );
  writeFileSync("src/lib/data/shots.real.json", JSON.stringify(shots));

  const byPlayer = {};
  for (const s of shots) byPlayer[s.player] = (byPlayer[s.player] || 0) + 1;
  const players = Object.keys(byPlayer).length;
  const onRoster = shots.filter((s) => ROSTER_IDS.has(s.espnId)).length;
  console.log(`\nDONE: ${shots.length} real playoff shots, ${players} players, ${games.length} games.`);
  console.log(`On-roster shots (with avatars): ${onRoster} / ${shots.length}`);
  console.log("Top shooters:", Object.entries(byPlayer).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([p, n]) => `${p}(${n})`).join(", "));
}
main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
