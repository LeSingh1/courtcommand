"""
train_real.py — CourtCommand retraining on REAL NBA data (no synthetic).

Retrains the two models that can be learned purely from the real ESPN data we
ingested, and refreshes their JSON exports + metadata:

  * archetypes   (unsupervised)  StandardScaler + KMeans(k=8) on the 536 CURRENT
                                 players (src/lib/data/players.real.json)
  * injury_risk  (supervised)    LogisticRegression on real (season t -> t+1)
                                 pairs from model/data/real_seasons.json, where
                                 the label is 1 if the player's NEXT season had
                                 gp < 62 (missed significant time).

The JSON schemas/keys are IDENTICAL to what train.py produced so the TypeScript
app reads them unchanged. shot_quality.json / win_probability.json /
mvp_model.json are NOT touched here (granular shot/play-by-play data isn't
exposed by ESPN, so those keep their historical training).

Re-runnable. Run:
    model/.venv/bin/python model/train_real.py
"""

import json
import os
import warnings

import joblib
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

warnings.filterwarnings("ignore")

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
EXPORTS = os.path.join(HERE, "exports")
ARTIFACTS = os.path.join(HERE, "artifacts")
DATA = os.path.join(HERE, "data")
os.makedirs(EXPORTS, exist_ok=True)
os.makedirs(ARTIFACTS, exist_ok=True)

REAL_SEASONS = os.path.join(DATA, "real_seasons.json")
REAL_PLAYERS = os.path.join(ROOT, "src", "lib", "data", "players.real.json")

RANDOM_STATE = 42

# Label threshold: a player "missed significant time" next season if gp < 62.
GP_SIGNIFICANT = 62
# League-typical back-to-back count (per-team schedule not present in the data).
B2B_CONST = 13
# Fallback frame_index (wtLb/htIn) when a player isn't in the current roster.
# League mean is ~2.85 (e.g. 250 lb / 80 in -> 3.13; 200 lb / 76 in -> 2.63).
FRAME_INDEX_FALLBACK = 2.85

DATA_SOURCE = (
    "real — ESPN public APIs (rosters, per-player season stats 2004-2026, "
    "salaries); ~3,332 real player-seasons + 536 current players. Archetypes + "
    "injury retrained on real data; shot-quality/win-probability/MVP retain "
    "their 2003-26 historical training (granular shot/play-by-play not exposed "
    "by ESPN)."
)


def section(title):
    print("\n" + "=" * 66)
    print(title)
    print("=" * 66)


def fnum(x, nd=4):
    return round(float(x), nd)


# ---------------------------------------------------------------------------
# data loading
# ---------------------------------------------------------------------------

def load_current_players() -> pd.DataFrame:
    with open(REAL_PLAYERS) as f:
        rows = json.load(f)
    df = pd.DataFrame(rows)
    # espnId -> str so it joins with real_seasons (which stores it as a string)
    df["espnId"] = df["espnId"].astype(str)
    return df


def load_seasons() -> pd.DataFrame:
    with open(REAL_SEASONS) as f:
        rows = json.load(f)
    df = pd.DataFrame(rows)
    df["espnId"] = df["espnId"].astype(str)
    return df


# ---------------------------------------------------------------------------
# archetypes  (StandardScaler + KMeans k=8) on the 536 CURRENT players
# ---------------------------------------------------------------------------

# Export feature names (schema-fixed). The model is fit on real current-player
# columns mapped to these features:
#   ppg        = ppg
#   rpg        = rpg
#   apg        = apg
#   three_rate = tpa            (3PA per game — "volume threes")
#   usage      = usg
#   ts         = tsp
#   def_index  = spg + bpg
#   bpg        = bpg
#   spg        = spg
ARCHE_FEATURES = ["ppg", "rpg", "apg", "three_rate", "usage", "ts", "def_index", "bpg", "spg"]


def _build_arche_matrix(players: pd.DataFrame) -> pd.DataFrame:
    p = players
    return pd.DataFrame({
        "ppg": p["ppg"].astype(float),
        "rpg": p["rpg"].astype(float),
        "apg": p["apg"].astype(float),
        "three_rate": p["tpa"].astype(float),               # volume threes (3PA/g)
        "usage": p["usg"].astype(float),
        "ts": p["tsp"].astype(float),
        "def_index": p["spg"].astype(float) + p["bpg"].astype(float),
        "bpg": p["bpg"].astype(float),
        "spg": p["spg"].astype(float),
    })[ARCHE_FEATURES]


def _score_archetypes(centroids_std, feature_names):
    """
    Assign one DISTINCT human archetype name per cluster by inspecting each
    standardized centroid (which features are highest). Every candidate defines
    a scoring direction over standardized feature space; we solve a greedy 1-1
    assignment so all 8 names are unique and each goes to the cluster that best
    embodies it.
    """
    fi = {f: i for i, f in enumerate(feature_names)}

    def s(c, f):
        return c[fi[f]]

    archetypes = [
        ("Primary Creator",
         lambda c: 1.4 * s(c, "usage") + 1.2 * s(c, "ppg") + 0.7 * s(c, "apg")),
        ("Scoring Guard",
         lambda c: 1.3 * s(c, "ppg") + 1.0 * s(c, "three_rate") + 0.6 * s(c, "usage")
                   - 0.6 * s(c, "rpg")),
        ("Floor-Spacing Big",
         lambda c: 1.3 * s(c, "rpg") + 1.0 * s(c, "three_rate") + 0.6 * s(c, "ts")
                   - 0.6 * s(c, "apg")),
        ("3-and-D Wing",
         lambda c: 1.2 * s(c, "three_rate") + 1.0 * s(c, "spg") + 0.7 * s(c, "ts")
                   - 0.8 * s(c, "usage")),
        ("Rim-Protecting Anchor",
         lambda c: 1.5 * s(c, "bpg") + 1.1 * s(c, "def_index") + 0.8 * s(c, "rpg")
                   - 1.0 * s(c, "three_rate")),
        ("Glass-Cleaning Roller",
         lambda c: 1.6 * s(c, "rpg") - 0.9 * s(c, "apg") - 0.9 * s(c, "three_rate")
                   - 0.6 * s(c, "usage")),
        ("Two-Way Wing",
         lambda c: 1.1 * s(c, "spg") + 0.9 * s(c, "def_index") + 0.6 * s(c, "ppg")
                   + 0.4 * s(c, "apg")),
        ("Low-Usage Role Player",
         lambda c: -1.4 * s(c, "usage") - 1.1 * s(c, "ppg") - 0.5 * s(c, "apg")),
    ]

    n = len(centroids_std)
    score = np.array([[fn(centroids_std[j]) for j in range(n)]
                      for (_, fn) in archetypes])

    assignment = {}
    used_arche, used_cluster = set(), set()
    order = np.dstack(np.unravel_index(np.argsort(-score, axis=None), score.shape))[0]
    for a, c in order:
        if a in used_arche or c in used_cluster:
            continue
        assignment[int(c)] = archetypes[a][0]
        used_arche.add(a)
        used_cluster.add(c)
    return assignment


def train_archetypes(players: pd.DataFrame):
    section("MODEL: archetypes  (StandardScaler + KMeans k=8, REAL current players)")

    Xdf = _build_arche_matrix(players)
    X = Xdf.values
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
        centroids.append({
            "name": assignment[k],
            "vector": [fnum(v, 5) for v in c_std.tolist()],
            "size": int((labels == k).sum()),
        })

    names = [c["name"] for c in centroids]
    assert len(set(names)) == 8, f"archetype names not distinct: {names}"

    export = {
        "features": ARCHE_FEATURES,
        "means": [fnum(m, 6) for m in means],
        "stds": [fnum(s, 6) for s in stds],
        "centroids": [{"name": c["name"], "vector": c["vector"]} for c in centroids],
    }

    print(f"  fit on {len(players)} real current players, {len(ARCHE_FEATURES)} features")
    print("  discovered archetypes:")
    for c in centroids:
        print(f"    - {c['name']:<26}  (n={c['size']})")

    joblib.dump({"scaler": scaler, "kmeans": km},
                os.path.join(ARTIFACTS, "archetypes.joblib"))
    with open(os.path.join(EXPORTS, "archetypes.json"), "w") as f:
        json.dump(export, f, indent=2)
    return names


# ---------------------------------------------------------------------------
# injury_risk  (LogisticRegression on real season t -> t+1 pairs)
# ---------------------------------------------------------------------------

INJ_FEATURES = ["age", "mpg", "games_missed_prev", "b2b_count", "frame_index"]


def build_injury_pairs(seasons: pd.DataFrame, players: pd.DataFrame) -> pd.DataFrame:
    """
    For each player-season t, look up the SAME espnId at season t+1. If a real
    t+1 exists, emit one training row:
        label = 1 if gp(t+1) < GP_SIGNIFICANT else 0
        age              = age(t)
        mpg              = mpg(t)
        games_missed_prev= 82 - gp(t)
        b2b_count        = B2B_CONST
        frame_index      = wtLb/htIn from current roster by espnId, else fallback
    """
    # frame_index lookup from current players (only place wt/ht exists)
    frame_by_id = {}
    for _, r in players.iterrows():
        ht = float(r.get("htIn") or 0)
        wt = float(r.get("wtLb") or 0)
        if ht > 0 and wt > 0:
            frame_by_id[str(r["espnId"])] = wt / ht

    # index seasons by (espnId, seasonYear) for O(1) t+1 lookup
    gp_by_key = {}
    for _, r in seasons.iterrows():
        gp_by_key[(str(r["espnId"]), int(r["seasonYear"]))] = int(r["gp"])

    rows = []
    for _, r in seasons.iterrows():
        eid = str(r["espnId"])
        yr = int(r["seasonYear"])
        nxt = gp_by_key.get((eid, yr + 1))
        if nxt is None:
            continue  # no real t+1 — skip
        label = 1 if nxt < GP_SIGNIFICANT else 0
        rows.append({
            "age": float(r["age"]),
            "mpg": float(r["mpg"]),
            "games_missed_prev": float(82 - int(r["gp"])),
            "b2b_count": float(B2B_CONST),
            "frame_index": float(frame_by_id.get(eid, FRAME_INDEX_FALLBACK)),
            "missed_significant_time": label,
        })
    return pd.DataFrame(rows)


def train_injury_risk(pairs: pd.DataFrame):
    section("MODEL: injury_risk  (LogisticRegression, REAL t -> t+1 pairs)")

    X = pairs[INJ_FEATURES]
    y = pairs["missed_significant_time"].values

    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.25, random_state=RANDOM_STATE, stratify=y
    )

    clf = LogisticRegression(C=1.0, max_iter=3000)
    clf.fit(X_tr, y_tr)
    proba = clf.predict_proba(X_te)[:, 1]
    auc = roc_auc_score(y_te, proba)
    metrics = {"auc": fnum(auc), "n": int(len(y_te))}

    cmap = dict(zip(INJ_FEATURES, clf.coef_[0]))
    export = {
        "intercept": fnum(clf.intercept_[0], 6),
        "coef": {c: fnum(cmap[c], 6) for c in INJ_FEATURES},
        "metrics": metrics,
    }

    print(f"  real pairs: {len(pairs)}  (train={len(X_tr)}, test={len(X_te)})")
    print(f"  base rate (missed_significant_time): {y.mean():.3f}")
    print(f"  TEST AUC = {metrics['auc']}   test n = {metrics['n']}")
    print("  coef:")
    for c in INJ_FEATURES:
        print(f"    {c:<18} {export['coef'][c]:>10}")

    joblib.dump(clf, os.path.join(ARTIFACTS, "injury_risk.joblib"))
    with open(os.path.join(EXPORTS, "injury_risk.json"), "w") as f:
        json.dump(export, f, indent=2)
    return metrics


# ---------------------------------------------------------------------------
# metadata
# ---------------------------------------------------------------------------

def update_metadata(n_player_seasons: int):
    section("UPDATE metadata.json")
    path = os.path.join(EXPORTS, "metadata.json")
    with open(path) as f:
        meta = json.load(f)
    meta["data_source"] = DATA_SOURCE
    meta["n_player_seasons"] = int(n_player_seasons)
    with open(path, "w") as f:
        json.dump(meta, f, indent=2)
    print(f"  data_source -> real ESPN")
    print(f"  n_player_seasons -> {n_player_seasons}")
    print(f"  (other keys preserved: {', '.join(k for k in meta if k not in ('data_source','n_player_seasons'))})")


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def main():
    section("LOADING REAL ESPN DATA")
    players = load_current_players()
    seasons = load_seasons()
    print(f"  current players : {len(players):>6,} rows  ({REAL_PLAYERS})")
    print(f"  player-seasons  : {len(seasons):>6,} rows  ({REAL_SEASONS})")

    arche_names = train_archetypes(players)

    pairs = build_injury_pairs(seasons, players)
    m_inj = train_injury_risk(pairs)

    update_metadata(len(seasons))

    section("DONE — refreshed exports on REAL data")
    print("  rewritten: archetypes.json, injury_risk.json, metadata.json")
    print("  untouched: shot_quality.json, win_probability.json, mvp_model.json")
    print("\n  archetypes (8 distinct):")
    for n in arche_names:
        print(f"    - {n}")
    print(f"\n  injury_risk: TEST AUC={m_inj['auc']}  test n={m_inj['n']}")


if __name__ == "__main__":
    main()
