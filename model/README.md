# CourtCommand — ML Training Pipeline

A real, re-runnable machine-learning pipeline that powers CourtCommand's NBA
analytics tools. It generates a synthetic-historical NBA dataset calibrated to
documented league trends (2003-04 → 2024-25), **trains five models**, evaluates
them on a held-out **test split**, and exports learned parameters as JSON for the
TypeScript app to consume at runtime (no Python needed in production).

## Quick start

```bash
# create the environment
python3 -m venv model/.venv
model/.venv/bin/pip install -r model/requirements.txt

# run the whole pipeline end-to-end (generates data, trains, evaluates, exports)
model/.venv/bin/python model/train.py
```

`train.py` is deterministic (seeded) and idempotent — re-running it regenerates
the data, retrains every model, rewrites `model/exports/*.json`, and re-saves the
fitted sklearn objects to `model/artifacts/*.joblib`. A quality gate at the end
fails the run if any model regresses below its bar.

## Files

| Path | What it is |
|---|---|
| `generate_data.py` | Synthetic-historical data generator (3 tables) + league trend functions |
| `train.py` | Full pipeline: generate → split → train → evaluate → export → quality-gate |
| `requirements.txt` | Pinned Python dependencies |
| `exports/*.json` | Learned parameters + test metrics (consumed by the TS app) |
| `artifacts/*.joblib` | Fitted sklearn estimators (scaler, regressors, classifiers, KMeans) |

## Data source

`stats.nba.com` is blocked in this environment and `nba_api` does not work, so the
micro-data is **synthetic-historical**: per-player, per-shot, and per-possession
rows are sampled to be distributionally faithful to **documented league-wide NBA
macro trends**, which are cross-checked against FiveThirtyEight's public NBA data
on GitHub (`raw.githubusercontent.com/fivethirtyeight/data`). The exact string is
recorded in `exports/metadata.json → data_source`.

Baked-in year trends (2003-04 → 2024-25):

- **3PA share of FGA**: ~0.18 → ~0.40 (steeper after ~2014)
- **League TS%**: ~0.52 → ~0.58
- **Pace**: dips around 2007 then rises back toward ~100 poss/48

### Tables

| Table | Rows | Key columns |
|---|---|---|
| `player_seasons` | 9,460 | season, age, mpg, ppg/rpg/apg/spg/bpg/topg, fg%/3p%/ft%, 3PA, usage, ts, per, bpm, net_rtg, team_wins, salary, games_played + labels `made_allstar`, `mvp_share`, `missed_significant_time` |
| `shots` | 320,000 | shot_type {rim,floater,midrange,catch3,pullup3,stepback3}, defender_dist, shot_clock, touch_time, dribbles, catch_and_shoot, period + label `made` |
| `game_states` | 208,000 | margin, seconds_left, home_has_ball, home_strength, period + label `home_win` (from simulated game trajectories, so win-prob is well-calibrated) |

## Models & features

| Model | Estimator | Features | Label |
|---|---|---|---|
| `shot_quality` | LogisticRegression (no global intercept) | one-hot `shot_type` + [defender_dist, shot_clock, touch_time, dribbles, catch_and_shoot] | `made` |
| `win_probability` | LogisticRegression | [margin, margin_over_sqrt_time, time_frac, possession, home_strength] | `home_win` |
| `mvp_model` | LinearRegression | [per, bpm, team_wins, ppg, ts] | `mvp_share` |
| `injury_risk` | LogisticRegression | [age, mpg, games_missed_prev, b2b_count, frame_index] | `missed_significant_time` |
| `archetypes` | StandardScaler + KMeans(k=8) | [ppg, rpg, apg, three_rate, usage, ts, def_index, bpg, spg] | (unsupervised) |

Engineered win-probability features (computed exactly as specified):

- `margin_over_sqrt_time = margin / sqrt(max(seconds_left/60, 0.1))`
- `time_frac = seconds_left / 2880`
- `possession = +1 if home_has_ball else -1`

`shot_quality` is fit **without a global intercept** and **with all six
`shot_type` dummies kept**, so each dummy's coefficient is the full per-type logit
base (`shot_type_base[t]`). Sanity-checked by hand:
`sigmoid(intercept + shot_type_base[t] + Σ coef·feature)` →
open rim ≈ **0.65**, contested stepback-3 ≈ **0.25** (documented anchors ~0.65 / ~0.30).

## Test-set metrics

All metrics below are computed on a 25% held-out **test** split (train/test split,
stratified for classifiers). Quality bars in parentheses; all pass.

| Model | Metric(s) | Test n | Bar | Result |
|---|---|---|---|---|
| shot_quality | **AUC 0.7033** · logloss 0.6268 · acc 0.6471 | 80,000 | AUC ≥ 0.70 | PASS |
| win_probability | **AUC 0.9304** · **Brier 0.1073** | 52,000 | AUC ≥ 0.85, Brier ≤ 0.16 | PASS |
| mvp_model | **R² 0.8059** · MAE 0.0100 | 2,365 | R² ≥ 0.60 | PASS |
| injury_risk | **AUC 0.6601** | 2,365 | AUC ≥ 0.65 | PASS |
| archetypes | 8 clusters over 9 features | 9,460 | (qualitative) | PASS |

### Discovered archetypes (k=8)

Each KMeans cluster is named via a greedy 1-to-1 assignment between cluster
centroids and a fixed set of basketball archetypes (scored over the standardized
feature space), guaranteeing eight distinct labels:

1. Primary Shot Creator
2. Interior Scoring Big
3. Floor General
4. Movement Sharpshooter
5. Rim-Protecting Anchor
6. 3-and-D Wing
7. Glass-Cleaning Roller
8. Low-Usage Role Player

## Exports (consumed by the TypeScript app)

`model/exports/` contains six JSON files with stable, documented keys:

- `shot_quality.json` — `intercept`, `shot_type_base{}`, `coef{}`, `metrics{}`
- `win_probability.json` — `intercept`, `coef{}`, `metrics{}`
- `mvp_model.json` — `intercept`, `coef{}`, `metrics{}`
- `injury_risk.json` — `intercept`, `coef{}`, `metrics{}`
- `archetypes.json` — `features[]`, `means[]`, `stds[]`, `centroids[]` (standardized vectors + names)
- `metadata.json` — seasons, row counts, `data_source`, `models[]`

The TS app reproduces a prediction by applying each model's exported coefficients
to the corresponding (standardized, where applicable) feature vector and pushing
the linear combination through a sigmoid (classifiers) or using it directly
(`mvp_model` linear output). For archetypes, standardize a player with
`means`/`stds`, then assign the nearest centroid by Euclidean distance.
