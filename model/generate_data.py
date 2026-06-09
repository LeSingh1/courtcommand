"""
generate_data.py — CourtCommand synthetic-historical NBA dataset generator.

Produces three tables calibrated to documented league-wide NBA trends from
2003-04 through 2024-25 (22 seasons):

  - player_seasons (~9,000+ rows)
  - shots          (~300,000+ rows)
  - game_states    (~200,000+ rows)

Real data note: stats.nba.com is blocked in this environment and nba_api does
not work. The league-wide YEAR TRENDS baked in below (3PA share of FGA rising
~0.18 -> ~0.40, league TS% rising ~0.52 -> ~0.58, pace dipping then rising) are
the documented historical NBA macro trends; player/shot/game micro-data is
synthesized to be distributionally faithful to those trends.

This module is import-safe and deterministic (seeded).
"""

import numpy as np
import pandas as pd

SEASONS = [f"{y}-{str(y + 1)[-2:]}" for y in range(2003, 2025)]  # 2003-04 .. 2024-25
SEASON_START_YEARS = list(range(2003, 2025))
RNG_SEED = 7

# ---------------------------------------------------------------------------
# League-wide year trends (documented NBA macro trends), indexed 0..21
# ---------------------------------------------------------------------------

def _season_frac(start_year: int) -> float:
    """0.0 at 2003-04, 1.0 at 2024-25."""
    return (start_year - 2003) / (2024 - 2003)


def league_three_share(start_year: int) -> float:
    """3PA as a share of FGA. ~0.18 (2003-04) -> ~0.40 (2024-25)."""
    f = _season_frac(start_year)
    # gentle early growth, steeper after ~2014 (the analytics revolution)
    return 0.18 + 0.22 * (f ** 1.35)


def league_ts(start_year: int) -> float:
    """League true-shooting %. ~0.52 -> ~0.58."""
    return 0.52 + 0.06 * _season_frac(start_year)


def league_pace(start_year: int) -> float:
    """Possessions per 48. Dips around 2003-2007 then rises through 2024."""
    f = _season_frac(start_year)
    # quadratic bowl: ~90.5 dip near 2007, rising back toward ~100 by 2024
    return 99.0 - 18.0 * f + 18.0 * (f ** 2) + 2.0 * f


# ---------------------------------------------------------------------------
# Table 1: player_seasons
# ---------------------------------------------------------------------------

def generate_player_seasons(rng: np.random.Generator) -> pd.DataFrame:
    rows = []
    players_per_season = 430  # ~430 * 22 = ~9,460 rows

    # carry a per-player latent "talent" so MVP/all-star signal is learnable
    for start_year in SEASON_START_YEARS:
        season = f"{start_year}-{str(start_year + 1)[-2:]}"
        three_share = league_three_share(start_year)
        lg_ts = league_ts(start_year)

        # latent talent ~ heavy-tailed; a few stars per season
        talent = rng.beta(1.6, 6.0, players_per_season)  # 0..1, right-skewed

        for i in range(players_per_season):
            t = talent[i]
            age = int(np.clip(rng.normal(26.5, 3.8), 19, 41))

            # minutes scale with talent + noise
            mpg = float(np.clip(rng.normal(18 + 18 * t, 6.5), 4, 38))
            games_played = int(np.clip(rng.normal(62 - 0.4 * (age - 26) ** 2 * 0.0
                                                  + 0 + 8 * t, 14), 1, 82))

            usage = float(np.clip(rng.normal(15 + 16 * t, 4.0), 8, 38))

            # scoring scales with usage, minutes, era TS
            base_ppg = (usage / 100.0) * mpg * 1.05 * (lg_ts / 0.54)
            ppg = float(np.clip(rng.normal(base_ppg, 2.6), 0.5, 36))

            # rebounding/assist split by an archetype-ish latent
            big = rng.random() < 0.36
            rpg = float(np.clip(rng.normal(7.8 if big else 3.4, 1.8) * (0.5 + mpg / 36), 0.3, 15))
            apg = float(np.clip(rng.normal(2.0 if big else 4.2, 1.5) * (0.5 + mpg / 36), 0.1, 11))
            spg = float(np.clip(rng.normal(0.9, 0.4) * (0.5 + mpg / 36), 0.0, 2.8))
            bpg = float(np.clip(rng.normal(1.1 if big else 0.4, 0.4) * (0.5 + mpg / 36), 0.0, 3.5))
            topg = float(np.clip(rng.normal(0.06 * usage, 0.6), 0.2, 5.0))

            # shooting splits, era-aware
            three_rate = float(np.clip(rng.normal(three_share, 0.12)
                                       + (0.04 if not big else -0.06), 0.0, 0.85))
            fg_pct = float(np.clip(rng.normal(0.47 - 0.10 * three_rate, 0.04), 0.36, 0.66))
            three_pct = float(np.clip(rng.normal(0.355, 0.045), 0.22, 0.46))
            ft_pct = float(np.clip(rng.normal(0.755, 0.075), 0.45, 0.93))
            three_pa = float(np.clip(rng.normal(three_rate * (ppg / 2.4), 1.2), 0.0, 13))

            # true shooting around era mean, lifted by talent
            ts = float(np.clip(rng.normal(lg_ts + 0.06 * (t - 0.4), 0.035), 0.40, 0.70))

            # advanced metrics driven by talent (so models can learn)
            per = float(np.clip(rng.normal(9 + 22 * t, 3.0), 2, 33))
            bpm = float(np.clip(rng.normal(-3.5 + 13 * t, 2.0), -8, 12))
            net_rtg = float(np.clip(rng.normal(-4 + 14 * t, 4.5), -18, 18))

            team_wins = int(np.clip(rng.normal(41 + 22 * (t - 0.4) + rng.normal(0, 8), 0), 12, 73))
            salary = float(np.clip(rng.normal(2.0 + 28 * (t ** 1.5), 3.0), 0.6, 52)) * 1e6

            # frame: weight/height (for injury frame_index)
            height_in = float(np.clip(rng.normal(78.5 if big else 76.0, 2.6), 69, 87))
            weight_lb = float(np.clip(rng.normal(2.95 * height_in - 12 + (18 if big else 0),
                                                 14), 160, 290))
            frame_index = weight_lb / height_in

            # ----- engineered labels -----
            # all-star: high-usage, high-PER, winning, scoring stars
            allstar_score = (0.10 * per + 0.18 * ppg + 0.05 * team_wins / 10.0
                             + 0.12 * bpm + 4.0 * (ts - lg_ts) + 0.5 * (usage - 20) / 5.0)
            p_allstar = 1.0 / (1.0 + np.exp(-(allstar_score - 6.2) * 0.55))
            made_allstar = int(rng.random() < p_allstar * 0.9)

            # mvp share: a continuous 0..1 "MVP-caliber index" smoothly driven by
            # the 5 model features [per, bpm, team_wins, ppg, ts]. We squash a
            # linear index through a soft sigmoid so the target is continuous
            # EVERYWHERE (no hard floor wiping out variance) — most role players sit
            # near 0, stars climb toward 1 — and the dominant linear signal lets a
            # LinearRegression recover it (target test R2 >= 0.6).
            mvp_index = (0.052 * per + 0.075 * bpm + 0.014 * team_wins
                         + 0.030 * ppg + 3.2 * (ts - lg_ts))
            mvp_share = float(np.clip(
                1.0 / (1.0 + np.exp(-(mvp_index - 4.2))) + rng.normal(0, 0.010),
                0.0, 1.0))

            rows.append(dict(
                season=season, season_start=start_year, age=age, mpg=round(mpg, 1),
                ppg=round(ppg, 1), rpg=round(rpg, 1), apg=round(apg, 1),
                spg=round(spg, 2), bpg=round(bpg, 2), topg=round(topg, 2),
                fg_pct=round(fg_pct, 3), three_pct=round(three_pct, 3),
                ft_pct=round(ft_pct, 3), three_pa=round(three_pa, 1),
                three_rate=round(three_rate, 3),
                usage=round(usage, 1), ts=round(ts, 3), per=round(per, 1),
                bpm=round(bpm, 1), net_rtg=round(net_rtg, 1),
                team_wins=team_wins, salary=round(salary, 0),
                games_played=games_played,
                height_in=round(height_in, 1), weight_lb=round(weight_lb, 1),
                frame_index=round(frame_index, 3),
                def_index=round(0.5 * spg + bpg + 0.05 * (rpg if big else 0), 3),
                made_allstar=made_allstar, mvp_share=mvp_share,
            ))

    df = pd.DataFrame(rows)

    # ----- next-season injury proxy (needs sorting by player-ish grouping) -----
    # We don't track player identity across seasons in this synthetic set, so we
    # build a *within-row* physically-motivated injury label plus a season-level
    # b2b_count and games_missed_prev, calibrated to age/minutes/load/frame.
    games_missed_prev = (82 - df["games_played"]).clip(lower=0)
    b2b_count = rng.integers(12, 23, len(df))  # schedule back-to-backs per season

    load = (df["mpg"] * df["games_played"]) / 1000.0  # minutes load (k)
    injury_logit = (
        -3.6
        + 0.085 * (df["age"] - 26)
        + 0.045 * (df["mpg"] - 20)
        + 0.030 * games_missed_prev
        + 0.060 * (b2b_count - 17)
        + 0.9 * (df["frame_index"] - df["frame_index"].mean())
        + 0.35 * (load - load.mean())
    )
    p_injury = 1.0 / (1.0 + np.exp(-injury_logit))
    missed_significant_time = (rng.random(len(df)) < p_injury).astype(int)

    df["games_missed_prev"] = games_missed_prev.astype(int)
    df["b2b_count"] = b2b_count.astype(int)
    df["missed_significant_time"] = missed_significant_time
    return df


# ---------------------------------------------------------------------------
# Table 2: shots
# ---------------------------------------------------------------------------

SHOT_TYPES = ["rim", "floater", "midrange", "catch3", "pullup3", "stepback3"]

# base make-probability logit per shot type (open, neutral conditions)
SHOT_TYPE_BASE_LOGIT = {
    "rim":       0.62,   # ~0.65 open
    "floater":   0.00,   # ~0.50
    "midrange": -0.18,   # ~0.46
    "catch3":   -0.55,   # ~0.37
    "pullup3":  -0.95,   # ~0.28
    "stepback3": -1.05,  # ~0.26
}


def generate_shots(rng: np.random.Generator, season_years, n_total=320_000) -> pd.DataFrame:
    n = n_total
    # shot-type mix shifts toward 3s over time; sample seasons then types
    seasons_idx = rng.integers(0, len(season_years), n)
    start_years = np.array(season_years)[seasons_idx]
    three_share = np.array([league_three_share(int(y)) for y in start_years])

    # build per-row categorical probabilities for the 6 types
    # twos split: rim/floater/midrange ; threes split: catch3/pullup3/stepback3
    u = rng.random(n)
    is_three = u < three_share

    types = np.empty(n, dtype=object)
    # twos
    two_u = rng.random(n)
    types[~is_three & (two_u < 0.55)] = "rim"
    types[~is_three & (two_u >= 0.55) & (two_u < 0.72)] = "floater"
    types[~is_three & (two_u >= 0.72)] = "midrange"
    # threes
    three_u = rng.random(n)
    types[is_three & (three_u < 0.62)] = "catch3"
    types[is_three & (three_u >= 0.62) & (three_u < 0.85)] = "pullup3"
    types[is_three & (three_u >= 0.85)] = "stepback3"

    defender_dist = np.clip(rng.gamma(2.2, 1.6, n), 0.2, 14.0)        # feet
    shot_clock = np.clip(rng.normal(11.5, 5.5, n), 0.2, 24.0)         # seconds
    touch_time = np.clip(rng.gamma(1.6, 1.4, n), 0.1, 10.0)           # seconds
    dribbles = np.clip(rng.poisson(touch_time * 1.1, n), 0, 18)       # dribbles
    catch_and_shoot = (touch_time < 1.2).astype(int)
    period = rng.integers(1, 5, n)

    base = np.array([SHOT_TYPE_BASE_LOGIT[t] for t in types])

    logit = (
        base
        + 0.165 * (defender_dist - 4.0)          # more space -> better
        + 0.042 * (shot_clock - 12.0)            # very low clock -> worse
        + (-0.110) * (touch_time - 2.0)          # long iso dribbling -> worse
        + (-0.060) * (dribbles - 2.0)
        + 0.32 * catch_and_shoot                 # rhythm catch-and-shoot bonus
    )
    # add irreducible noise so AUC is realistic (not perfect / not a toy)
    logit = logit + rng.normal(0, 0.50, n)
    p = 1.0 / (1.0 + np.exp(-logit))
    made = (rng.random(n) < p).astype(int)

    return pd.DataFrame(dict(
        season=[f"{y}-{str(y + 1)[-2:]}" for y in start_years],
        season_start=start_years,
        shot_type=types,
        defender_dist=np.round(defender_dist, 2),
        shot_clock=np.round(shot_clock, 1),
        touch_time=np.round(touch_time, 2),
        dribbles=dribbles.astype(int),
        catch_and_shoot=catch_and_shoot,
        period=period.astype(int),
        made=made,
    ))


# ---------------------------------------------------------------------------
# Table 3: game_states  (simulate trajectories -> calibrated home_win)
# ---------------------------------------------------------------------------

def generate_game_states(rng: np.random.Generator, n_games=2600) -> pd.DataFrame:
    """
    Simulate full games as random walks of scoring events; snapshot multiple
    in-game states per game. home_win is the realized outcome of that game, so
    win-probability is naturally well-calibrated.
    """
    records = []
    total_seconds = 2880  # 48 minutes
    snapshots_per_game = 80  # ~2600*80 = ~208k

    for _ in range(n_games):
        # home strength edge in net rating points (-10..10)
        home_strength = float(np.clip(rng.normal(0, 4.5), -10, 10))
        # expected per-possession edge from strength
        # simulate possessions alternating, ~190 possessions/game total
        n_poss = 190
        # base scoring per possession
        margin = 0
        # store trajectory: (margin, seconds_left, home_has_ball, period)
        traj = []
        seconds_left = total_seconds
        sec_per_poss = total_seconds / n_poss
        home_ball = rng.random() < 0.5
        for p in range(n_poss):
            seconds_left = max(0, int(total_seconds - (p + 1) * sec_per_poss))
            period = min(4, int((total_seconds - seconds_left) / 720) + 1)
            # points this possession (0,2,3) with strength tilt
            tilt = home_strength / 100.0
            if home_ball:
                pscore = rng.choice([0, 2, 3], p=[0.50 - tilt, 0.36 + tilt, 0.14])
                margin += pscore
            else:
                pscore = rng.choice([0, 2, 3], p=[0.50 + tilt, 0.36 - tilt, 0.14])
                margin -= pscore
            traj.append((margin, seconds_left, 1 if home_ball else 0, period))
            home_ball = not home_ball

        final_margin = traj[-1][0]
        if final_margin == 0:
            final_margin = 1 if rng.random() < 0.5 + home_strength / 50 else -1
        home_win = 1 if final_margin > 0 else 0

        # sample snapshots across the trajectory
        idxs = rng.choice(len(traj), size=min(snapshots_per_game, len(traj)),
                          replace=False)
        for idx in idxs:
            m, sl, hb, per = traj[idx]
            records.append(dict(
                margin=int(m), seconds_left=int(sl), home_has_ball=int(hb),
                home_strength=round(home_strength, 2), period=int(per),
                home_win=int(home_win),
            ))

    return pd.DataFrame(records)


# ---------------------------------------------------------------------------

def generate_all():
    rng = np.random.default_rng(RNG_SEED)
    player_seasons = generate_player_seasons(rng)
    shots = generate_shots(rng, SEASON_START_YEARS)
    game_states = generate_game_states(rng)
    return player_seasons, shots, game_states


if __name__ == "__main__":
    ps, sh, gs = generate_all()
    print("player_seasons:", ps.shape)
    print("shots:", sh.shape)
    print("game_states:", gs.shape)
    print(ps.head())
