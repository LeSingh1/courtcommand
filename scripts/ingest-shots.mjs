// Real NBA shots ingestion — pulls actual shooting plays (player, shot type,
// court coordinates, distance, make/miss, game context) from ESPN play-by-play
// for recent games, so the Shot Quality Predictor can grade REAL shots and
// replay them on the court. Run: node scripts/ingest-shots.mjs
import { writeFileSync, readFileSync } from "node:fs";

const ROSTER = JSON.parse(readFileSync("src/lib/data/players.real.json", "utf8"));
const ROSTER_IDS = new Set(ROSTER.map((p) => p.espnId));

const H = { "User-Agent": "Mozilla/5.0 CourtCommand/1.0" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJson(u, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(u, { headers: H });
      if (r.ok) return await r.json();
    } catch {}
    await sleep(300 * (i + 1));
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
  // collect recent completed game ids by walking back from today
  const base = new Date();
  const ids = new Set();
  for (let off = 1; off < 60 && ids.size < 36; off++) {
    const d = new Date(base);
    d.setDate(d.getDate() - off);
    const sb = await getJson(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${ymd(d)}`);
    for (const e of sb?.events || []) {
      if (e?.status?.type?.completed) ids.add(e.id);
    }
  }
  const gameIds = [...ids].slice(0, 36);
  console.log(`Collected ${gameIds.length} recent completed games.`);

  const shots = [];
  let g = 0;
  for (const gid of gameIds) {
    g++;
    const s = await getJson(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${gid}`);
    if (!s) continue;
    const gameName = s.header?.competitions?.[0]?.competitors?.map((c) => c.team?.abbreviation).join(" vs ") || gid;
    const date = s.header?.competitions?.[0]?.date;
    // athlete id -> { name, team } from the boxscore
    const idMap = {};
    for (const tb of s.boxscore?.players || []) {
      const abbr = tb.team?.abbreviation;
      for (const stat of tb.statistics || []) {
        for (const a of stat.athletes || []) {
          if (a.athlete?.id) idMap[a.athlete.id] = { name: a.athlete.displayName, team: abbr };
        }
      }
    }
    for (const p of s.plays || []) {
      if (!p.shootingPlay) continue;
      const c = p.coordinate;
      if (!c || SENTINEL(c.x) || SENTINEL(c.y)) continue;
      const ath = p.participants?.[0]?.athlete;
      if (!ath?.id) continue;
      if (!ROSTER_IDS.has(Number(ath.id))) continue; // keep known players (headshots/teams resolve)
      const info = idMap[ath.id] || {};
      const text = p.text || "";
      const distM = text.match(/(\d+)-foot/);
      const dist = distM ? parseInt(distM[1], 10) : c.y <= 3 ? 2 : Math.round(c.y);
      const made = !!p.scoringPlay;
      const value = p.scoreValue || (/(three|3 point)/i.test(text) ? 3 : 2);
      // map ESPN coords (x 0..50 width, y 0..47 from baseline) → CourtChart (500x470, hoop ~250,52)
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
    }
    if (g % 8 === 0) console.log(`  …${g}/${gameIds.length} games, ${shots.length} shots`);
  }

  // group by player, keep players with >= 4 shots, cap 40 each (recent first)
  const groups = {};
  for (const s of shots) (groups[s.espnId] ||= []).push(s);
  const kept = [];
  for (const arr of Object.values(groups)) {
    if (arr.length < 4) continue;
    arr.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    kept.push(...arr.slice(0, 40));
  }
  kept.sort((a, b) => (a.player < b.player ? -1 : a.player > b.player ? 1 : 0));
  writeFileSync("src/lib/data/shots.real.json", JSON.stringify(kept));
  const byPlayer = {};
  for (const s of kept) byPlayer[s.player] = (byPlayer[s.player] || 0) + 1;
  const players = Object.keys(byPlayer).length;
  console.log(`\nDONE: ${kept.length} real shots across ${gameIds.length} games, ${players} players.`);
  console.log("Top shooters:", Object.entries(byPlayer).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([p, n]) => `${p}(${n})`));
}
main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
