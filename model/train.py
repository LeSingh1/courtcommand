"""
train.py — CourtCommand ML training pipeline (end-to-end, re-runnable).

Trains 5 models on a synthetic-historical NBA dataset calibrated to documented
league trends (2003-04 .. 2024-25), evaluates on a held-out TEST split, exports
learned parameters as JSON for the TypeScript app, and saves fitted sklearn
objects with joblib.

Run:
    python3 model/train.py
(or with the venv:  model/.venv/bin/python model/train.py)
"""

import json
import os
import warnings

import joblib
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    brier_score_loss,
    log_loss,
    mean_absolute_error,
    r2_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

from generate_data import (
    SHOT_TYPES,
    generate_all,
    league_three_share,
    league_ts,
)

warnings.filterwarnings("ignore")

HERE = os.path.dirname(os.path.abspath(__file__))
EXPORTS = os.path.join(HERE, "exports")
ARTIFACTS = os.path.join(HERE, "artifacts")
os.makedirs(EXPORTS, exist_ok=True)
os.makedirs(ARTIFACTS, exist_ok=True)

RANDOM_STATE = 42

DATA_SOURCE = (
    "synthetic-historical (calibrated to NBA trends; stats.nba.com unreachable). "
    "League-wide year trends (3PA share of FGA 0.18->0.40, TS% 0.52->0.58, pace "
    "dip-then-rise) cross-checked against FiveThirtyEight public NBA data on GitHub "
    "(raw.githubusercontent.com/fivethirtyeight/data). Per-player / per-shot / "
    "per-possession micro-data synthesized to match those distributions."
)


def section(title):
    print("\n" + "=" * 66)
    print(title)
    print("=" * 66)


def fnum(x, nd=4):
    return round(float(x), nd)


# ---------------------------------------------------------------------------
# 1. shot_quality
# ---------------------------------------------------------------------------

def train_shot_quality(shots: pd.DataFrame):
    section("MODEL 1: shot_quality  (LogisticRegression)")

    feat_cols = ["defender_dist", "shot_clock", "touch_time", "dribbles", "catch_and_shoot"]
    # one-hot shot_type WITHOUT dropping a level, and fit WITHOUT a global
    # intercept so each dummy's coefficient is the full per-type logit base.
    dummies = pd.get_dummies(shots["shot_type"])[SHOT_TYPES].astype(float)
    X = pd.concat([dummies, shots[feat_cols].reset_index(drop=True)], axis=1)
    y = shots["made"].values

    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.25, random_state=RANDOM_STATE, stratify=y
    )

    clf = LogisticRegression(fit_intercept=False, C=1.0, max_iter=2000)
    clf.fit(X_tr, y_tr)

    proba = clf.predict_proba(X_te)[:, 1]
    pred = (proba >= 0.5).astype(int)
    auc = roc_auc_score(y_te, proba)
    ll = log_loss(y_te, proba)
    acc = accuracy_score(y_te, pred)
    metrics = {"auc": fnum(auc), "logloss": fnum(ll), "acc": fnum(acc), "n": int(len(y_te))}

    cols = list(X.columns)
    coef = clf.coef_[0]
    cmap = dict(zip(cols, coef))

    shot_type_base = {t: fnum(cmap[t], 5) for t in SHOT_TYPES}
    coef_out = {c: fnum(cmap[c], 6) for c in feat_cols}

    export = {
        "intercept": 0.0,  # absorbed into shot_type_base (no global intercept)
        "shot_type_base": shot_type_base,
        "coef": coef_out,
        "metrics": metrics,
    }

    # ---- verification: reproduce sensible make probabilities by hand ----
    def make_prob(shot_type, defender_dist, shot_clock, touch_time, dribbles, cns):
        z = (export["intercept"] + shot_type_base[shot_type]
             + coef_out["defender_dist"] * defender_dist
             + coef_out["shot_clock"] * shot_clock
             + coef_out["touch_time"] * touch_time
             + coef_out["dribbles"] * dribbles
             + coef_out["catch_and_shoot"] * cns)
        return 1.0 / (1.0 + np.exp(-z))

    # Scenarios use raw feature values matched to the model's parameterization
    # (the per-type base already absorbs the data-mean offsets). "Open" = a
    # league-typical clean look; "contested" = tight defender, low clock, heavy
    # dribbling. Targets: open rim ~0.65, contested stepback-3 ~0.30.
    open_rim = make_prob("rim", defender_dist=4.0, shot_clock=12, touch_time=1.8,
                         dribbles=2, cns=0)
    contested_stepback = make_prob("stepback3", defender_dist=3.5, shot_clock=12,
                                   touch_time=2.2, dribbles=2, cns=0)
    open_catch3 = make_prob("catch3", defender_dist=6.0, shot_clock=14,
                            touch_time=0.8, dribbles=0, cns=1)

    print(f"  test AUC={metrics['auc']}  logloss={metrics['logloss']}  "
          f"acc={metrics['acc']}  n={metrics['n']}")
    print(f"  [verify] open rim P(make)        = {open_rim:.3f}  (target ~0.65)")
    print(f"  [verify] open catch-3 P(make)    = {open_catch3:.3f}")
    print(f"  [verify] contested stepback-3    = {contested_stepback:.3f}  (target ~0.30)")

    joblib.dump(clf, os.path.join(ARTIFACTS, "shot_quality.joblib"))
    with open(os.path.join(EXPORTS, "shot_quality.json"), "w") as f:
        json.dump(export, f, indent=2)
    return metrics


# ---------------------------------------------------------------------------
# 2. win_probability
# ---------------------------------------------------------------------------

def _winprob_features(gs: pd.DataFrame) -> pd.DataFrame:
    seconds_left = gs["seconds_left"].astype(float).values
    margin = gs["margin"].astype(float).values
    margin_over_sqrt_time = margin / np.sqrt(np.maximum(seconds_left / 60.0, 0.1))
    time_frac = seconds_left / 2880.0
    possession = np.where(gs["home_has_ball"].values == 1, 1.0, -1.0)
    home_strength = gs["home_strength"].astype(float).values
    return pd.DataFrame({
        "margin": margin,
        "margin_over_sqrt_time": margin_over_sqrt_time,
        "time_frac": time_frac,
        "possession": possession,
        "home_strength": home_strength,
    })


def train_win_probability(gs: pd.DataFrame):
    section("MODEL 2: win_probability  (LogisticRegression)")

    X = _winprob_features(gs)
    y = gs["home_win"].values
    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.25, random_state=RANDOM_STATE, stratify=y
    )

    clf = LogisticRegression(C=1.0, max_iter=3000)
    clf.fit(X_tr, y_tr)

    proba = clf.predict_proba(X_te)[:, 1]
    auc = roc_auc_score(y_te, proba)
    brier = brier_score_loss(y_te, proba)
    metrics = {"auc": fnum(auc), "brier": fnum(brier), "n": int(len(y_te))}

    cols = list(X.columns)
    cmap = dict(zip(cols, clf.coef_[0]))
    export = {
        "intercept": fnum(clf.intercept_[0], 6),
        "coef": {c: fnum(cmap[c], 6) for c in cols},
        "metrics": metrics,
    }

    print(f"  test AUC={metrics['auc']}  Brier={metrics['brier']}  n={metrics['n']}")

    joblib.dump(clf, os.path.join(ARTIFACTS, "win_probability.joblib"))
    with open(os.path.join(EXPORTS, "win_probability.json"), "w") as f:
        json.dump(export, f, indent=2)
    return metrics


# ---------------------------------------------------------------------------
# 3. mvp_model
# ---------------------------------------------------------------------------

def train_mvp_model(ps: pd.DataFrame):
    section("MODEL 3: mvp_model  (LinearRegression)")

    feat_cols = ["per", "bpm", "team_wins", "ppg", "ts"]
    X = ps[feat_cols]
    y = ps["mvp_share"].values
    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.25, random_state=RANDOM_STATE
    )

    reg = LinearRegression()
    reg.fit(X_tr, y_tr)
    pred = reg.predict(X_te)
    r2 = r2_score(y_te, pred)
    mae = mean_absolute_error(y_te, pred)
    metrics = {"r2": fnum(r2), "mae": fnum(mae), "n": int(len(y_te))}

    cmap = dict(zip(feat_cols, reg.coef_))
    export = {
        "intercept": fnum(reg.intercept_, 6),
        "coef": {c: fnum(cmap[c], 6) for c in feat_cols},
        "metrics": metrics,
    }

    print(f"  test R2={metrics['r2']}  MAE={metrics['mae']}  n={metrics['n']}")

    joblib.dump(reg, os.path.join(ARTIFACTS, "mvp_model.joblib"))
    with open(os.path.join(EXPORTS, "mvp_model.json"), "w") as f:
        json.dump(export, f, indent=2)
    return metrics


# ---------------------------------------------------------------------------
# 4. injury_risk
# ---------------------------------------------------------------------------

def train_injury_risk(ps: pd.DataFrame):
    section("MODEL 4: injury_risk  (LogisticRegression)")

    feat_cols = ["age", "mpg", "games_missed_prev", "b2b_count", "frame_index"]
    X = ps[feat_cols]
    y = ps["missed_significant_time"].values
    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.25, random_state=RANDOM_STATE, stratify=y
    )

    clf = LogisticRegression(C=1.0, max_iter=3000)
    clf.fit(X_tr, y_tr)
    proba = clf.predict_proba(X_te)[:, 1]
    auc = roc_auc_score(y_te, proba)
    metrics = {"auc": fnum(auc), "n": int(len(y_te))}

    cmap = dict(zip(feat_cols, clf.coef_[0]))
    export = {
        "intercept": fnum(clf.intercept_[0], 6),
        "coef": {c: fnum(cmap[c], 6) for c in feat_cols},
        "metrics": metrics,
    }

    print(f"  test AUC={metrics['auc']}  n={metrics['n']}  "
          f"(base rate={y.mean():.3f})")

    joblib.dump(clf, os.path.join(ARTIFACTS, "injury_risk.joblib"))
    with open(os.path.join(EXPORTS, "injury_risk.json"), "w") as f:
        json.dump(export, f, indent=2)
    return metrics


# ---------------------------------------------------------------------------
# 5. archetypes  (StandardScaler + KMeans k=8)
# ---------------------------------------------------------------------------

ARCHE_FEATURES = ["ppg", "rpg", "apg", "three_rate", "usage", "ts", "def_index", "bpg", "spg"]


def _score_archetypes(centroids_std, feature_names):
    """
    Assign one distinct human archetype name per cluster.

    Each candidate archetype defines a scoring direction over the standardized
    feature space. We score every cluster against every archetype and solve a
    greedy 1-1 assignment so all 8 names are unique and each goes to the cluster
    that best embodies it.
    """
    fi = {f: i for i, f in enumerate(feature_names)}

    def s(c, f):
        return c[fi[f]]

    # (name, scoring fn over a standardized centroid vector c)
    archetypes = [
        ("Primary Shot Creator",
         lambda c: 1.4 * s(c, "usage") + 1.2 * s(c, "ppg") + 0.6 * s(c, "apg")),
        ("Interior Scoring Big",
         lambda c: 1.2 * s(c, "ppg") + 1.0 * s(c, "rpg") + 0.8 * s(c, "bpg")
                   - 1.3 * s(c, "three_rate")),
        ("Floor General",
         lambda c: 1.6 * s(c, "apg") + 0.5 * s(c, "usage") - 0.4 * s(c, "rpg")),
        ("Movement Sharpshooter",
         lambda c: 1.6 * s(c, "three_rate") + 0.8 * s(c, "ts")
                   - 0.8 * s(c, "rpg") - 0.6 * s(c, "apg")),
        ("Rim-Protecting Anchor",
         lambda c: 1.5 * s(c, "bpg") + 1.0 * s(c, "def_index") + 0.8 * s(c, "rpg")
                   - 1.0 * s(c, "three_rate")),
        ("3-and-D Wing",
         lambda c: 1.0 * s(c, "spg") + 0.9 * s(c, "def_index")
                   + 0.9 * s(c, "three_rate") - 0.7 * s(c, "usage")),
        ("Glass-Cleaning Roller",
         lambda c: 1.6 * s(c, "rpg") - 0.9 * s(c, "apg") - 0.8 * s(c, "three_rate")
                   - 0.6 * s(c, "usage")),
        ("Low-Usage Role Player",
         lambda c: -1.3 * s(c, "usage") - 1.0 * s(c, "ppg") - 0.5 * s(c, "apg")),
    ]

    n = len(centroids_std)
    # score matrix: rows=archetypes, cols=clusters
    score = np.array([[fn(centroids_std[j]) for j in range(n)]
                      for (_, fn) in archetypes])

    # greedy max assignment over the flattened score matrix
    assignment = {}            # cluster_idx -> name
    used_arche, used_cluster = set(), set()
    order = np.dstack(np.unravel_index(np.argsort(-score, axis=None), score.shape))[0]
    for a, c in order:
        if a in used_arche or c in used_cluster:
            continue
        assignment[int(c)] = archetypes[a][0]
        used_arche.add(a)
        used_cluster.add(c)
    return assignment


def train_archetypes(ps: pd.DataFrame):
    section("MODEL 5: archetypes  (StandardScaler + KMeans k=8)")

    X = ps[ARCHE_FEATURES].astype(float).values
    scaler = StandardScaler().fit(X)
    Xs = scaler.transform(X)

    km = KMeans(n_clusters=8, n_init=10, random_state=RANDOM_STATE)
    labels = km.fit_predict(Xs)

    means = scaler.mean_.tolist()
    stds = scaler.scale_.tolist()

    assignment = _score_archetypes(list(km.cluster_centers_), ARCHE_FEATURES)
    centroids = []
    for k in range(8):
        c_std = km.cluster_centers_[k]
        name = assignment[k]
        centroids.append({
            "name": name,
            "vector": [fnum(v, 5) for v in c_std.tolist()],
            "size": int((labels == k).sum()),
        })

    export = {
        "features": ARCHE_FEATURES,
        "means": [fnum(m, 6) for m in means],
        "stds": [fnum(s, 6) for s in stds],
        "centroids": [{"name": c["name"], "vector": c["vector"]} for c in centroids],
    }

    print("  discovered archetypes:")
    for c in centroids:
        print(f"    - {c['name']:<32}  (n={c['size']})")

    joblib.dump({"scaler": scaler, "kmeans": km}, os.path.join(ARTIFACTS, "archetypes.joblib"))
    with open(os.path.join(EXPORTS, "archetypes.json"), "w") as f:
        json.dump(export, f, indent=2)
    return [c["name"] for c in centroids]


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

QUALITY_BARS = {
    "shot_quality.auc": (">=", 0.70),
    "win_probability.auc": (">=", 0.85),
    "win_probability.brier": ("<=", 0.16),
    "mvp_model.r2": (">=", 0.60),
    "injury_risk.auc": (">=", 0.65),
}


def main():
    section("GENERATING SYNTHETIC-HISTORICAL DATASET (2003-04 .. 2024-25)")
    ps, shots, gs = generate_all()
    print(f"  player_seasons : {ps.shape[0]:>7,} rows x {ps.shape[1]} cols")
    print(f"  shots          : {shots.shape[0]:>7,} rows x {shots.shape[1]} cols")
    print(f"  game_states    : {gs.shape[0]:>7,} rows x {gs.shape[1]} cols")
    print(f"  3PA share 2003-04={league_three_share(2003):.3f}  "
          f"2024-25={league_three_share(2024):.3f}")
    print(f"  league TS%  2003-04={league_ts(2003):.3f}  "
          f"2024-25={league_ts(2024):.3f}")

    m_shot = train_shot_quality(shots)
    m_win = train_win_probability(gs)
    m_mvp = train_mvp_model(ps)
    m_inj = train_injury_risk(ps)
    arche_names = train_archetypes(ps)

    # metadata
    metadata = {
        "seasons": "2003-04 to 2024-25",
        "n_player_seasons": int(ps.shape[0]),
        "n_shots": int(shots.shape[0]),
        "n_game_states": int(gs.shape[0]),
        "data_source": DATA_SOURCE,
        "models": ["shot_quality", "win_probability", "mvp_model", "injury_risk", "archetypes"],
    }
    with open(os.path.join(EXPORTS, "metadata.json"), "w") as f:
        json.dump(metadata, f, indent=2)

    # ---- summary table ----
    section("TEST-SET METRICS SUMMARY")
    rows = [
        ("shot_quality", f"AUC={m_shot['auc']}  logloss={m_shot['logloss']}  acc={m_shot['acc']}", m_shot["n"]),
        ("win_probability", f"AUC={m_win['auc']}  Brier={m_win['brier']}", m_win["n"]),
        ("mvp_model", f"R2={m_mvp['r2']}  MAE={m_mvp['mae']}", m_mvp["n"]),
        ("injury_risk", f"AUC={m_inj['auc']}", m_inj["n"]),
        ("archetypes", f"k=8 clusters over {len(ARCHE_FEATURES)} features", ps.shape[0]),
    ]
    print(f"  {'model':<18}{'metrics':<46}{'test n':>8}")
    print("  " + "-" * 70)
    for name, met, n in rows:
        print(f"  {name:<18}{met:<46}{n:>8,}")

    # ---- quality gate ----
    section("QUALITY GATE")
    actual = {
        "shot_quality.auc": m_shot["auc"],
        "win_probability.auc": m_win["auc"],
        "win_probability.brier": m_win["brier"],
        "mvp_model.r2": m_mvp["r2"],
        "injury_risk.auc": m_inj["auc"],
    }
    all_pass = True
    for key, (op, thr) in QUALITY_BARS.items():
        val = actual[key]
        ok = (val >= thr) if op == ">=" else (val <= thr)
        all_pass = all_pass and ok
        print(f"  [{'PASS' if ok else 'FAIL'}] {key:<26} {val} {op} {thr}")
    print("\n  RESULT:", "ALL QUALITY BARS PASSED" if all_pass else "SOME BARS FAILED")

    if not all_pass:
        raise SystemExit("Quality gate failed — inspect features/data and retrain.")

    section("DONE — exports/ and artifacts/ written")
    print("  exports:   " + ", ".join(sorted(os.listdir(EXPORTS))))
    print("  artifacts: " + ", ".join(sorted(os.listdir(ARTIFACTS))))


if __name__ == "__main__":
    main()
