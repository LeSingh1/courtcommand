import raw from "./officials.real.json";

// Real 2026 playoff officiating data from ESPN box scores: which officials
// worked each game and how many free throws each team shot. Assignments and
// FT counts are facts; everything derived here is a correlation on a small
// playoff sample, not evidence of intent.

export interface OfficialGameTeam {
  abbr: string;
  ftm: number;
  fta: number;
  homeAway?: "home" | "away";
}

export interface OfficialGame {
  gameId: string;
  teams: OfficialGameTeam[];
  officials: string[];
}

export const OFFICIAL_GAMES = raw as unknown as OfficialGame[];

// Below this many games, a split is too thin to read as anything but noise.
export const REF_SMALL_SAMPLE_GAMES = 4;

export interface RefTeamSplit {
  team: string;
  gamesWith: number; // games this team played with this official
  gamesWithout: number; // this team's other playoff games in the dataset
  ftaWith: number; // team avg FTA per game with this official
  ftaWithout: number; // team avg FTA per game in its games without them
  delta: number; // ftaWith - ftaWithout
  se: number; // standard error of the delta (Welch two-sample)
  withinNoise: boolean; // |delta| < 1.96·se — indistinguishable from chance
  smallSample: boolean; // either side of the split is under the floor
}

export interface RefSplit {
  official: string;
  games: number; // playoff games worked
  avgTotalFta: number; // both teams combined, per game
  avgFtaDiff: number; // home FTA minus away FTA, per game
  smallSample: boolean; // games worked under the floor
  teams: RefTeamSplit[]; // sorted by |delta| descending
}

const home = (g: OfficialGame): OfficialGameTeam =>
  g.teams.find((t) => t.homeAway === "home") ?? g.teams[1];
const away = (g: OfficialGame): OfficialGameTeam =>
  g.teams.find((t) => t.homeAway === "away") ?? g.teams[0];

// Per-official splits, all arithmetic straight off the ingested games.
export function refSplits(games: OfficialGame[] = OFFICIAL_GAMES): RefSplit[] {
  // Every team's full playoff FTA log, so "without this ref" is computable.
  const teamGames = new Map<string, { gameId: string; fta: number }[]>();
  for (const g of games) {
    for (const t of g.teams) {
      let arr = teamGames.get(t.abbr);
      if (!arr) {
        arr = [];
        teamGames.set(t.abbr, arr);
      }
      arr.push({ gameId: g.gameId, fta: t.fta });
    }
  }

  const byRef = new Map<string, OfficialGame[]>();
  for (const g of games) {
    for (const name of g.officials) {
      let arr = byRef.get(name);
      if (!arr) {
        arr = [];
        byRef.set(name, arr);
      }
      arr.push(g);
    }
  }

  const out: RefSplit[] = [];
  for (const [official, worked] of byRef) {
    const n = worked.length;
    const avgTotalFta = worked.reduce((a, g) => a + g.teams.reduce((s, t) => s + t.fta, 0), 0) / n;
    const avgFtaDiff = worked.reduce((a, g) => a + (home(g).fta - away(g).fta), 0) / n;

    // Per-team: avg FTA in games this official worked vs that team's other games.
    const withRef = new Map<string, { ids: Set<string>; fta: number }>();
    for (const g of worked) {
      for (const t of g.teams) {
        let e = withRef.get(t.abbr);
        if (!e) {
          e = { ids: new Set(), fta: 0 };
          withRef.set(t.abbr, e);
        }
        e.ids.add(g.gameId);
        e.fta += t.fta;
      }
    }
    const teams: RefTeamSplit[] = [];
    const variance = (xs: number[], m: number) =>
      xs.length > 1 ? xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1) : 0;
    for (const [abbr, e] of withRef) {
      const all = teamGames.get(abbr) ?? [];
      const without = all.filter((x) => !e.ids.has(x.gameId));
      const withFtas = all.filter((x) => e.ids.has(x.gameId)).map((x) => x.fta);
      const gamesWith = e.ids.size;
      const ftaWith = e.fta / gamesWith;
      const woFtas = without.map((x) => x.fta);
      const ftaWithout = woFtas.length ? woFtas.reduce((a, x) => a + x, 0) / woFtas.length : 0;
      const delta = ftaWith - ftaWithout;
      // Welch standard error of the difference in means — the honest yardstick
      // for whether a split is anything but chance at these sample sizes.
      const se = Math.sqrt(
        (gamesWith > 1 ? variance(withFtas, ftaWith) / gamesWith : 25) +
          (woFtas.length > 1 ? variance(woFtas, ftaWithout) / woFtas.length : 25),
      );
      teams.push({
        team: abbr,
        gamesWith,
        gamesWithout: without.length,
        ftaWith,
        ftaWithout,
        delta,
        se,
        withinNoise: Math.abs(delta) < 1.96 * se,
        smallSample: gamesWith < REF_SMALL_SAMPLE_GAMES || without.length < REF_SMALL_SAMPLE_GAMES,
      });
    }
    teams.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    out.push({
      official,
      games: n,
      avgTotalFta,
      avgFtaDiff,
      smallSample: n < REF_SMALL_SAMPLE_GAMES,
      teams,
    });
  }
  return out.sort((a, b) => b.games - a.games || a.official.localeCompare(b.official));
}
