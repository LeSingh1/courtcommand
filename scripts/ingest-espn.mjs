// CourtCommand real-data ingestion — pulls every current NBA player, real
// per-game stats, real salaries, real bios + headshots, real team records,
// and real 2003-04 → present season history (for model training) from ESPN's
// public APIs. No API key required. Run: node scripts/ingest-espn.mjs
//
// Outputs:
//   src/lib/data/players.real.json   — current-season players (real)
//   src/lib/data/teams.real.json     — teams with real records + payroll
//   model/data/real_seasons.json     — historical player-seasons (real, for training)
import { writeFileSync, mkdirSync } from "node:fs";

const HEADERS = { "User-Agent": "Mozilla/5.0 CourtCommand/1.0" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (res.ok) return await res.json();
    } catch {
      /* retry */
    }
    await sleep(400 * (i + 1));
  }
  return null;
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let idx = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (idx < items.length) {
        const cur = idx++;
        out[cur] = await fn(items[cur], cur);
      }
    }),
  );
  return out;
}

// static, factual conference/division map
const CONF_DIV = {
  ATL: ["East", "Southeast"], BOS: ["East", "Atlantic"], BKN: ["East", "Atlantic"], CHA: ["East", "Southeast"],
  CHI: ["East", "Central"], CLE: ["East", "Central"], DAL: ["West", "Southwest"], DEN: ["West", "Northwest"],
  DET: ["East", "Central"], GS: ["West", "Pacific"], HOU: ["West", "Southwest"], IND: ["East", "Central"],
  LAC: ["West", "Pacific"], LAL: ["West", "Pacific"], MEM: ["West", "Southwest"], MIA: ["East", "Southeast"],
  MIL: ["East", "Central"], MIN: ["West", "Northwest"], NO: ["West", "Southwest"], NY: ["East", "Atlantic"],
  OKC: ["West", "Northwest"], ORL: ["East", "Southeast"], PHI: ["East", "Atlantic"], PHX: ["West", "Pacific"],
  POR: ["West", "Northwest"], SAC: ["West", "Pacific"], SA: ["West", "Southwest"], TOR: ["East", "Atlantic"],
  UTAH: ["West", "Northwest"], WSH: ["East", "Southeast"],
};
// normalize ESPN abbr -> our canonical abbr
const ABBR = { GS: "GSW", NO: "NOP", NY: "NYK", SA: "SAS", UTAH: "UTA", WSH: "WAS" };
const norm = (a) => ABBR[a] || a;

const parsePair = (s) => {
  if (typeof s !== "string") return [0, 0];
  const [m, a] = s.split("-").map((x) => parseFloat(x));
  return [m || 0, a || 0];
};
const num = (x) => {
  const v = parseFloat(x);
  return Number.isFinite(v) ? v : 0;
};

function parseSeasonRow(labels, stats) {
  const i = (name) => labels.indexOf(name);
  const [, fga] = parsePair(stats[i("FG")]);
  const [, fta] = parsePair(stats[i("FT")]);
  const [, tpa] = parsePair(stats[i("3PT")]);
  return {
    gp: num(stats[i("GP")]),
    mpg: num(stats[i("MIN")]),
    ppg: num(stats[i("PTS")]),
    rpg: num(stats[i("REB")]),
    apg: num(stats[i("AST")]),
    spg: num(stats[i("STL")]),
    bpg: num(stats[i("BLK")]),
    topg: num(stats[i("TO")]),
    fgp: num(stats[i("FG%")]) / 100,
    tpp: num(stats[i("3P%")]) / 100,
    ftp: num(stats[i("FT%")]) / 100,
    fga,
    fta,
    tpa,
  };
}

// --- derived advanced metrics computed from REAL box stats ---
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function derive(b) {
  const tsa = b.fga + 0.44 * b.fta;
  const tsp = tsa > 0 ? b.ppg / (2 * tsa) : b.fgp || 0.5;
  const fgm = b.fga * b.fgp;
  const ftm = b.fta * b.ftp;
  // Hollinger Game Score per game
  const gmsc =
    b.ppg + 0.4 * fgm - 0.7 * b.fga - 0.4 * (b.fta - ftm) + 0.7 * (b.rpg * 0.3) + 0.3 * (b.rpg * 0.7) +
    b.spg + 0.7 * b.apg + 0.7 * b.bpg - 0.4 * 2 - b.topg;
  const per = clamp(gmsc * 1.15 + 6, 3, 36);
  const usg = clamp(((b.fga + 0.44 * b.fta + b.topg) * 48) / (b.mpg || 1) * 0.84, 3, 38);
  const bpm = clamp((per - 15) * 0.55 + (b.apg - 2) * 0.2 + (b.spg + b.bpg - 1.5) * 0.6, -9, 13);
  const netRtg = clamp(Math.round(bpm * 0.9), -12, 12);
  return { tsp: r3(tsp), usg: r1(usg), per: r1(per), bpm: r1(bpm), netRtg };
}
const r1 = (v) => Math.round(v * 10) / 10;
const r3 = (v) => Math.round(v * 1000) / 1000;

const slug = (name, id) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + id;

async function main() {
  console.log("Fetching teams…");
  const teamsJson = await getJson("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams");
  const teamEntries = teamsJson.sports[0].leagues[0].teams.map((t) => t.team);

  console.log("Fetching standings…");
  const standings = await getJson("https://site.api.espn.com/apis/v2/sports/basketball/nba/standings");
  const recByAbbr = {};
  const walk = (node) => {
    if (!node) return;
    if (node.standings?.entries) {
      for (const e of node.standings.entries) {
        const ab = norm(e.team.abbreviation);
        const get = (n) => e.stats.find((s) => s.name === n)?.value;
        recByAbbr[ab] = {
          wins: get("wins") ?? 0,
          losses: get("losses") ?? 0,
          pf: get("avgPointsFor") ?? get("pointsFor"),
          pa: get("avgPointsAgainst") ?? get("pointsAgainst"),
        };
      }
    }
    (node.children || []).forEach(walk);
  };
  walk(standings);

  // fetch rosters
  console.log(`Fetching ${teamEntries.length} rosters…`);
  const rosters = await pool(teamEntries, 8, async (t) => {
    const j = await getJson(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${t.id}/roster`);
    return { team: t, athletes: j?.athletes || [] };
  });

  // collect athletes
  const teams = [];
  const athleteJobs = [];
  for (const { team, athletes } of rosters) {
    const abbr = norm(team.abbreviation);
    const [conf, div] = CONF_DIV[norm(team.abbreviation)] || ["East", "Atlantic"];
    const rec = recByAbbr[abbr] || {};
    const pf = rec.pf ?? 113;
    const pa = rec.pa ?? 113;
    let payroll = 0;
    for (const a of athletes) {
      payroll += (a.contract?.salary || 0) / 1e6;
      athleteJobs.push({ a, abbr });
    }
    teams.push({
      abbr,
      name: team.name,
      city: team.location,
      conf,
      div,
      color: "#" + (team.color || "888888"),
      color2: "#" + (team.alternateColor || "222222"),
      wins: rec.wins ?? 0,
      losses: rec.losses ?? 0,
      pace: r1(clamp((pf + pa) / 2.3, 95, 104)),
      ortg: r1(clamp((pf * 100) / clamp((pf + pa) / 2.3, 95, 104), 105, 124)),
      drtg: r1(clamp((pa * 100) / clamp((pf + pa) / 2.3, 95, 104), 105, 124)),
      payroll: r1(payroll),
    });
  }

  console.log(`Fetching stats for ${athleteJobs.length} players…`);
  const players = [];
  const seasons = []; // historical for training
  let done = 0;
  await pool(athleteJobs, 12, async ({ a, abbr }) => {
    done++;
    if (done % 60 === 0) console.log(`  …${done}/${athleteJobs.length}`);
    const sj = await getJson(`https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${a.id}/stats`);
    if (!sj) return;
    const avg = (sj.categories || []).find((c) => c.name === "averages");
    if (!avg || !avg.statistics?.length) return;
    const labels = avg.labels;
    // historical rows (2003-04 → now)
    const contractsByYear = {};
    for (const c of a.contracts || []) {
      const y = c.season?.year;
      if (y) contractsByYear[y] = c.salary;
    }
    const curAge = a.age ?? 25;
    for (const st of avg.statistics) {
      const year = st.season?.year;
      if (!year || year < 2004) continue;
      const b = parseSeasonRow(labels, st.stats);
      if (b.gp < 5) continue;
      const d = derive(b);
      seasons.push({
        espnId: a.id,
        name: a.fullName,
        seasonYear: year,
        seasonName: st.season?.displayName,
        age: curAge - (2026 - year),
        salary: (contractsByYear[year] || 0) / 1e6,
        ...b,
        ...d,
      });
    }
    // current-season row = max year (prefer current team)
    const maxYear = Math.max(...avg.statistics.map((s) => s.season?.year || 0));
    if (maxYear < 2025) return; // not currently active with stats
    const curRows = avg.statistics.filter((s) => (s.season?.year || 0) === maxYear);
    const cur = curRows[curRows.length - 1];
    const b = parseSeasonRow(labels, cur.stats);
    if (b.gp < 1) return;
    const d = derive(b);
    const pos = a.position?.abbreviation || "G";
    players.push({
      id: slug(a.fullName, a.id),
      espnId: Number(a.id),
      name: a.fullName,
      team: abbr,
      pos: ["PG", "SG", "SF", "PF", "C"].includes(pos) ? pos : pos[0] === "G" ? "SG" : pos[0] === "F" ? "SF" : "C",
      age: a.age ?? 25,
      htIn: Math.round(a.height || 78),
      wtLb: Math.round(a.weight || 215),
      exp: a.experience?.years ?? 0,
      salary: r1((a.contract?.salary || 0) / 1e6),
      gp: b.gp,
      mpg: r1(b.mpg),
      ppg: r1(b.ppg),
      rpg: r1(b.rpg),
      apg: r1(b.apg),
      spg: r1(b.spg),
      bpg: r1(b.bpg),
      topg: r1(b.topg),
      fgp: r3(b.fgp),
      tpp: r3(b.tpp),
      ftp: r3(b.ftp),
      tpa: r1(b.tpa),
      usg: d.usg,
      tsp: d.tsp,
      per: d.per,
      bpm: d.bpm,
      netRtg: d.netRtg,
    });
  });

  players.sort((a, b) => b.ppg - a.ppg);
  mkdirSync("src/lib/data", { recursive: true });
  mkdirSync("model/data", { recursive: true });
  writeFileSync("src/lib/data/players.real.json", JSON.stringify(players));
  writeFileSync("src/lib/data/teams.real.json", JSON.stringify(teams, null, 0));
  writeFileSync("model/data/real_seasons.json", JSON.stringify(seasons));

  console.log(`\nDONE: ${players.length} current players, ${teams.length} teams, ${seasons.length} historical player-seasons.`);
  console.log("Sample:", players.slice(0, 3).map((p) => `${p.name} ${p.team} ${p.ppg}/${p.rpg}/${p.apg} $${p.salary}M`));
}

main().catch((e) => {
  console.error("INGEST FAILED:", e);
  process.exit(1);
});
