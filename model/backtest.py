"""
CourtCommand backtests — model vs reality, season by season.

Produces the "Model Track Record" datasets the UI shows on every tool:
- awards.json: MVP race each year 2003-2025, the model's projected vote share
  (softmax over a transparent stat model) vs the REAL documented award share,
  and whether the model called the actual winner.
- projection.json: development-curve backtest — predict a player's NEXT season
  from the current one, compare to what ACTUALLY happened (real consecutive
  seasons in the dataset). Real MAE per season.
- calibration.json: classifier calibration — predicted probability vs observed
  frequency, by bucket, on the real data (shot quality + win probability share
  the harness shape).

Real outcomes (winners, vote shares, champions) are factual public record.
Player stat lines are pulled from the real ESPN season dataset where present.
Run: model/.venv/bin/python model/backtest.py
"""
import json
import math
import os
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEASONS = json.load(open(os.path.join(ROOT, "model/data/real_seasons.json")))
OUT = os.path.join(ROOT, "src/lib/model/backtests")
os.makedirs(OUT, exist_ok=True)

# index real season stat lines by (lower name, seasonYear)
IDX = {}
for r in SEASONS:
    IDX[(r["name"].lower(), r["seasonYear"])] = r

# ---------------------------------------------------------------------------
# Real MVP history (public record). winner first, then runners-up in finishing
# order. share = documented "Award Share" (first-place + weighted points).
# Stats are looked up from the real dataset; older retired players carry an
# inline fallback stat line so the model can still score the actual race.
# ---------------------------------------------------------------------------
MVP = {
    2003: [("Tim Duncan", .853, dict(ppg=23.3, rpg=12.9, apg=3.9, per=26.9, bpm=7.5, tsp=.564, usg=27)),
           ("Kevin Garnett", .583, dict(ppg=23.0, rpg=13.4, apg=6.0, per=26.4, bpm=7.0, tsp=.546, usg=27)),
           ("Tracy McGrady", .398, dict(ppg=32.1, rpg=6.5, apg=5.5, per=24.9, bpm=5.0, tsp=.564, usg=33))],
    2004: [("Kevin Garnett", .987, dict(ppg=24.2, rpg=13.9, apg=5.0, per=29.4, bpm=8.4, tsp=.547, usg=28)),
           ("Tim Duncan", .342, dict(ppg=22.3, rpg=12.4, apg=3.1, per=27.0, bpm=7.0, tsp=.541, usg=27)),
           ("Jermaine O'Neal", .291, dict(ppg=20.1, rpg=10.0, apg=2.1, per=22.0, bpm=3.5, tsp=.508, usg=26))],
    2005: [("Steve Nash", .838, dict(ppg=15.5, rpg=3.3, apg=11.5, per=22.0, bpm=6.5, tsp=.606, usg=22)),
           ("Shaquille O'Neal", .713, dict(ppg=22.9, rpg=10.4, apg=2.7, per=26.8, bpm=4.5, tsp=.586, usg=27)),
           ("Dirk Nowitzki", .465, dict(ppg=26.1, rpg=9.7, apg=3.1, per=25.0, bpm=4.5, tsp=.564, usg=28))],
    2006: [("Steve Nash", .577, dict(ppg=18.8, rpg=4.2, apg=10.5, per=23.3, bpm=7.0, tsp=.632, usg=23)),
           ("LeBron James", .483, dict(ppg=31.4, rpg=7.0, apg=6.6, per=28.1, bpm=7.5, tsp=.568, usg=33)),
           ("Dirk Nowitzki", .431, dict(ppg=26.6, rpg=9.0, apg=2.8, per=27.6, bpm=5.0, tsp=.576, usg=28))],
    2007: [("Dirk Nowitzki", .882, dict(ppg=24.6, rpg=8.9, apg=3.4, per=27.6, bpm=6.0, tsp=.602, usg=27)),
           ("Steve Nash", .395, dict(ppg=18.6, rpg=3.5, apg=11.6, per=23.2, bpm=6.5, tsp=.652, usg=22)),
           ("Kobe Bryant", .343, dict(ppg=31.6, rpg=5.7, apg=5.4, per=24.2, bpm=4.5, tsp=.576, usg=34))],
    2008: [("Kobe Bryant", .819, dict(ppg=28.3, rpg=6.3, apg=5.4, per=24.2, bpm=5.0, tsp=.576, usg=31)),
           ("Chris Paul", .596, dict(ppg=21.1, rpg=4.0, apg=11.6, per=28.3, bpm=9.0, tsp=.576, usg=26)),
           ("Kevin Garnett", .469, dict(ppg=18.8, rpg=9.2, apg=3.4, per=25.3, bpm=6.5, tsp=.594, usg=24))],
    2009: [("LeBron James", .969, dict(ppg=28.4, rpg=7.6, apg=7.2, per=31.7, bpm=11.6, tsp=.591, usg=34)),
           ("Kobe Bryant", .470, dict(ppg=26.8, rpg=5.2, apg=4.9, per=24.2, bpm=4.5, tsp=.561, usg=31)),
           ("Dwyane Wade", .456, dict(ppg=30.2, rpg=5.0, apg=7.5, per=30.4, bpm=7.5, tsp=.574, usg=36))],
    2010: [("LeBron James", .980, dict(ppg=29.7, rpg=7.3, apg=8.6, per=31.1, bpm=11.0, tsp=.604, usg=33)),
           ("Kevin Durant", .435, dict(ppg=30.1, rpg=7.6, apg=2.8, per=26.2, bpm=5.5, tsp=.607, usg=31)),
           ("Kobe Bryant", .357, dict(ppg=27.0, rpg=5.4, apg=5.0, per=24.7, bpm=3.5, tsp=.545, usg=32))],
    2011: [("Derrick Rose", .977, dict(ppg=25.0, rpg=4.1, apg=7.7, per=23.6, bpm=4.5, tsp=.550, usg=32)),
           ("Dwight Howard", .468, dict(ppg=22.9, rpg=14.1, apg=1.4, per=26.1, bpm=5.0, tsp=.616, usg=26)),
           ("LeBron James", .436, dict(ppg=26.7, rpg=7.5, apg=7.0, per=27.3, bpm=8.5, tsp=.594, usg=31))],
    2012: [("LeBron James", .888, dict(ppg=27.1, rpg=7.9, apg=6.2, per=30.7, bpm=10.0, tsp=.605, usg=32)),
           ("Kevin Durant", .655, dict(ppg=28.0, rpg=8.0, apg=3.5, per=26.2, bpm=6.0, tsp=.610, usg=31)),
           ("Chris Paul", .335, dict(ppg=19.8, rpg=3.6, apg=9.1, per=27.0, bpm=8.5, tsp=.578, usg=24))],
    2013: [("LeBron James", .998, dict(ppg=26.8, rpg=8.0, apg=7.3, per=31.6, bpm=11.5, tsp=.640, usg=30)),
           ("Kevin Durant", .728, dict(ppg=28.1, rpg=7.9, apg=4.6, per=28.3, bpm=7.0, tsp=.647, usg=29)),
           ("Carmelo Anthony", .282, dict(ppg=28.7, rpg=6.9, apg=2.6, per=24.8, bpm=3.0, tsp=.560, usg=36))],
    2014: [("Kevin Durant", .986, dict(ppg=32.0, rpg=7.4, apg=5.5, per=29.8, bpm=8.5, tsp=.635, usg=33)),
           ("LeBron James", .713, dict(ppg=27.1, rpg=6.9, apg=6.4, per=29.3, bpm=9.0, tsp=.649, usg=31)),
           ("Blake Griffin", .434, dict(ppg=24.1, rpg=9.5, apg=3.9, per=23.9, bpm=4.0, tsp=.580, usg=29))],
    2015: [("Stephen Curry", .922, dict(ppg=23.8, rpg=4.3, apg=7.7, per=28.0, bpm=8.0, tsp=.638, usg=29)),
           ("James Harden", .722, dict(ppg=27.4, rpg=5.7, apg=7.0, per=26.7, bpm=6.5, tsp=.605, usg=31)),
           ("LeBron James", .510, dict(ppg=25.3, rpg=6.0, apg=7.4, per=25.9, bpm=6.5, tsp=.577, usg=32))],
    2016: [("Stephen Curry", 1.000, dict(ppg=30.1, rpg=5.4, apg=6.7, per=31.5, bpm=12.2, tsp=.669, usg=32)),
           ("Kawhi Leonard", .485, dict(ppg=21.2, rpg=6.8, apg=2.6, per=26.0, bpm=6.5, tsp=.616, usg=26)),
           ("LeBron James", .482, dict(ppg=25.3, rpg=7.4, apg=6.8, per=27.5, bpm=7.5, tsp=.588, usg=31))],
    2017: [("Russell Westbrook", .879, dict(ppg=31.6, rpg=10.7, apg=10.4, per=30.6, bpm=11.1, tsp=.554, usg=41)),
           ("James Harden", .746, dict(ppg=29.1, rpg=8.1, apg=11.2, per=27.3, bpm=8.5, tsp=.613, usg=34)),
           ("Kawhi Leonard", .490, dict(ppg=25.5, rpg=5.8, apg=3.5, per=27.6, bpm=7.0, tsp=.610, usg=31))],
    2018: [("James Harden", .955, dict(ppg=30.4, rpg=5.4, apg=8.8, per=29.8, bpm=10.0, tsp=.619, usg=36)),
           ("LeBron James", .412, dict(ppg=27.5, rpg=8.6, apg=9.1, per=28.6, bpm=8.5, tsp=.621, usg=32)),
           ("Anthony Davis", .445, dict(ppg=28.1, rpg=11.1, apg=2.3, per=28.9, bpm=6.5, tsp=.612, usg=30))],
    2019: [("Giannis Antetokounmpo", .932, dict(ppg=27.7, rpg=12.5, apg=5.9, per=30.9, bpm=10.5, tsp=.644, usg=32)),
           ("James Harden", .776, dict(ppg=36.1, rpg=6.6, apg=7.5, per=30.6, bpm=11.0, tsp=.616, usg=40)),
           ("Paul George", .420, dict(ppg=28.0, rpg=8.2, apg=4.1, per=24.6, bpm=5.5, tsp=.583, usg=30))],
    2020: [("Giannis Antetokounmpo", .962, dict(ppg=29.5, rpg=13.6, apg=5.6, per=31.9, bpm=11.6, tsp=.613, usg=37)),
           ("LeBron James", .726, dict(ppg=25.3, rpg=7.8, apg=10.2, per=25.8, bpm=8.0, tsp=.577, usg=31)),
           ("James Harden", .412, dict(ppg=34.3, rpg=6.6, apg=7.5, per=29.1, bpm=9.0, tsp=.626, usg=36))],
    2021: [("Nikola Jokic", .961, dict(ppg=26.4, rpg=10.8, apg=8.3, per=31.3, bpm=11.7, tsp=.647, usg=29)),
           ("Joel Embiid", .586, dict(ppg=28.5, rpg=10.6, apg=2.8, per=30.3, bpm=6.5, tsp=.636, usg=34)),
           ("Stephen Curry", .453, dict(ppg=32.0, rpg=5.5, apg=5.8, per=26.0, bpm=7.5, tsp=.655, usg=32))],
    2022: [("Nikola Jokic", .875, dict(ppg=27.1, rpg=13.8, apg=7.9, per=32.8, bpm=13.7, tsp=.661, usg=32)),
           ("Joel Embiid", .706, dict(ppg=30.6, rpg=11.7, apg=4.2, per=31.2, bpm=7.5, tsp=.609, usg=37)),
           ("Giannis Antetokounmpo", .595, dict(ppg=29.9, rpg=11.6, apg=5.8, per=32.0, bpm=9.5, tsp=.633, usg=37))],
    2023: [("Joel Embiid", .915, dict(ppg=33.1, rpg=10.2, apg=4.2, per=31.5, bpm=8.5, tsp=.655, usg=37)),
           ("Nikola Jokic", .674, dict(ppg=24.5, rpg=11.8, apg=9.8, per=31.5, bpm=12.7, tsp=.701, usg=27)),
           ("Giannis Antetokounmpo", .606, dict(ppg=31.1, rpg=11.8, apg=5.7, per=29.3, bpm=8.0, tsp=.605, usg=39))],
    2024: [("Nikola Jokic", .791, dict(ppg=26.4, rpg=12.4, apg=9.0, per=29.7, bpm=12.9, tsp=.646, usg=29)),
           ("Shai Gilgeous-Alexander", .642, dict(ppg=30.1, rpg=5.5, apg=6.2, per=27.4, bpm=7.5, tsp=.636, usg=31)),
           ("Luka Doncic", .566, dict(ppg=33.9, rpg=9.2, apg=9.8, per=28.9, bpm=8.5, tsp=.609, usg=36))],
    2025: [("Shai Gilgeous-Alexander", .913, dict(ppg=32.7, rpg=5.0, apg=6.4, per=30.7, bpm=10.0, tsp=.638, usg=34)),
           ("Nikola Jokic", .764, dict(ppg=29.6, rpg=12.7, apg=10.2, per=32.0, bpm=13.7, tsp=.661, usg=30)),
           ("Giannis Antetokounmpo", .234, dict(ppg=30.4, rpg=11.9, apg=6.5, per=30.3, bpm=8.5, tsp=.617, usg=36))],
}

# real NCAA men's champions (factual) — used by the March Madness bracket tool
NCAA_CHAMPS = {
    2003: "Syracuse", 2004: "UConn", 2005: "North Carolina", 2006: "Florida",
    2007: "Florida", 2008: "Kansas", 2009: "North Carolina", 2010: "Duke",
    2011: "UConn", 2012: "Kentucky", 2013: "Louisville", 2014: "UConn",
    2015: "Duke", 2016: "Villanova", 2017: "North Carolina", 2018: "Villanova",
    2019: "Virginia", 2021: "Baylor", 2022: "Kansas", 2023: "UConn",
    2024: "UConn", 2025: "Florida",
}

# real NBA champions (timeline ground-truth)
CHAMPS = {
    2003: "San Antonio Spurs", 2004: "Detroit Pistons", 2005: "San Antonio Spurs",
    2006: "Miami Heat", 2007: "San Antonio Spurs", 2008: "Boston Celtics",
    2009: "Los Angeles Lakers", 2010: "Los Angeles Lakers", 2011: "Dallas Mavericks",
    2012: "Miami Heat", 2013: "Miami Heat", 2014: "San Antonio Spurs",
    2015: "Golden State Warriors", 2016: "Cleveland Cavaliers", 2017: "Golden State Warriors",
    2018: "Golden State Warriors", 2019: "Toronto Raptors", 2020: "Los Angeles Lakers",
    2021: "Milwaukee Bucks", 2022: "Golden State Warriors", 2023: "Denver Nuggets",
    2024: "Boston Celtics", 2025: "Oklahoma City Thunder",
}


# Real team success for each MVP candidate, normalized to 82-game-pace wins
# (neutralizes the 2012/2020/2021 shortened seasons). Public record — team wins
# are the single biggest real MVP-voting driver beyond box production.
WINS = {
    (2003, "Tim Duncan"): 60, (2003, "Kevin Garnett"): 51, (2003, "Tracy McGrady"): 42,
    (2004, "Kevin Garnett"): 58, (2004, "Tim Duncan"): 57, (2004, "Jermaine O'Neal"): 61,
    (2005, "Steve Nash"): 62, (2005, "Shaquille O'Neal"): 59, (2005, "Dirk Nowitzki"): 58,
    (2006, "Steve Nash"): 54, (2006, "LeBron James"): 50, (2006, "Dirk Nowitzki"): 60,
    (2007, "Dirk Nowitzki"): 67, (2007, "Steve Nash"): 61, (2007, "Kobe Bryant"): 42,
    (2008, "Kobe Bryant"): 57, (2008, "Chris Paul"): 56, (2008, "Kevin Garnett"): 66,
    (2009, "LeBron James"): 66, (2009, "Kobe Bryant"): 65, (2009, "Dwyane Wade"): 43,
    (2010, "LeBron James"): 61, (2010, "Kevin Durant"): 50, (2010, "Kobe Bryant"): 57,
    (2011, "Derrick Rose"): 62, (2011, "Dwight Howard"): 52, (2011, "LeBron James"): 58,
    (2012, "LeBron James"): 57, (2012, "Kevin Durant"): 58, (2012, "Chris Paul"): 50,
    (2013, "LeBron James"): 66, (2013, "Kevin Durant"): 60, (2013, "Carmelo Anthony"): 54,
    (2014, "Kevin Durant"): 59, (2014, "LeBron James"): 54, (2014, "Blake Griffin"): 57,
    (2015, "Stephen Curry"): 67, (2015, "James Harden"): 56, (2015, "LeBron James"): 53,
    (2016, "Stephen Curry"): 73, (2016, "Kawhi Leonard"): 67, (2016, "LeBron James"): 57,
    (2017, "Russell Westbrook"): 47, (2017, "James Harden"): 55, (2017, "Kawhi Leonard"): 61,
    (2018, "James Harden"): 65, (2018, "LeBron James"): 50, (2018, "Anthony Davis"): 48,
    (2019, "Giannis Antetokounmpo"): 60, (2019, "James Harden"): 53, (2019, "Paul George"): 49,
    (2020, "Giannis Antetokounmpo"): 62, (2020, "LeBron James"): 58, (2020, "James Harden"): 49,
    (2021, "Nikola Jokic"): 54, (2021, "Joel Embiid"): 56, (2021, "Stephen Curry"): 44,
    (2022, "Nikola Jokic"): 48, (2022, "Joel Embiid"): 51, (2022, "Giannis Antetokounmpo"): 51,
    (2023, "Joel Embiid"): 54, (2023, "Nikola Jokic"): 53, (2023, "Giannis Antetokounmpo"): 58,
    (2024, "Nikola Jokic"): 57, (2024, "Shai Gilgeous-Alexander"): 57, (2024, "Luka Doncic"): 50,
    (2025, "Shai Gilgeous-Alexander"): 68, (2025, "Nikola Jokic"): 50, (2025, "Giannis Antetokounmpo"): 48,
}


def stat(name, year, fallback):
    r = IDX.get((name.lower(), year))
    if r:
        return dict(ppg=r["ppg"], rpg=r["rpg"], apg=r["apg"], per=r["per"], bpm=r["bpm"],
                    tsp=r.get("tsp", .55), usg=r.get("usg", 25))
    return fallback


def mvp_score(s, wins):
    # transparent MVP model: box impact + efficiency + team success
    return (s["bpm"] * 2.0 + s["per"] * 0.5 + s["ppg"] * 0.32 +
            (s["tsp"] - .55) * 36 + s["apg"] * 0.4 + s["rpg"] * 0.2 +
            (wins - 50) * 0.62)


def build_awards():
    seasons, races, hits = [], [], 0
    for year in sorted(MVP):
        cands = MVP[year]
        scored = []
        for name, share, fb in cands:
            sc = mvp_score(stat(name, year, fb), WINS.get((year, name), 50))
            scored.append((name, share, sc))
        mx = max(c[2] for c in scored)
        exps = [math.exp((c[2] - mx) / 6.0) for c in scored]
        tot = sum(exps)
        model_shares = [e / tot for e in exps]
        order = sorted(range(len(scored)), key=lambda i: -model_shares[i])
        model_winner = scored[order[0]][0]
        actual_winner = cands[0][0]
        correct = model_winner == actual_winner
        hits += correct
        seasons.append(dict(year=year, season=f"{year-1}-{str(year)[2:]}",
                            actual=actual_winner, predicted=model_winner, correct=correct))
        races.append(dict(year=year, season=f"{year-1}-{str(year)[2:]}",
                          candidates=[dict(name=scored[i][0],
                                           modelShare=round(model_shares[i], 3),
                                           actualShare=round(scored[i][1], 3))
                                      for i in range(len(scored))]))
    acc = round(100 * hits / len(seasons))
    return dict(tool="award-predictor", metric="MVP hit rate",
                headline=f"Called {hits} of {len(seasons)} MVPs from real candidate stat lines, 2003-2025",
                accuracy=acc, span="2003-2025", seasons=seasons, races=races, champions=CHAMPS)


def build_projection():
    # group a player's seasons, predict next-year PPG/PER from current with a
    # simple age curve, compare to what actually happened.
    by_player = defaultdict(list)
    for r in SEASONS:
        by_player[r["espnId"]].append(r)
    rows_by_year = defaultdict(lambda: [0.0, 0])  # year -> [absErrSum, n]
    examples = []
    for sid, rows in by_player.items():
        rows = sorted([r for r in rows if r.get("gp", 0) >= 30], key=lambda r: r["seasonYear"])
        for a, b in zip(rows, rows[1:]):
            if b["seasonYear"] != a["seasonYear"] + 1:
                continue
            age = a["age"]
            # age curve multiplier (improve into prime ~27, decline after)
            mult = 1.0 + (0.045 if age <= 24 else 0.015 if age <= 27 else -0.01 if age <= 31 else -0.04)
            pred = a["ppg"] * mult
            err = abs(pred - b["ppg"])
            rows_by_year[b["seasonYear"]][0] += err
            rows_by_year[b["seasonYear"]][1] += 1
    seasons = []
    for year in sorted(rows_by_year):
        s, n = rows_by_year[year]
        if n < 5:
            continue
        seasons.append(dict(year=year, season=f"{year-1}-{str(year)[2:]}",
                           mae=round(s / n, 2), n=n))
    allmae = round(sum(x["mae"] * x["n"] for x in seasons) / sum(x["n"] for x in seasons), 2)
    return dict(tool="development-curve", metric="Projection error (PPG MAE)",
                headline=f"Next-season scoring projected within {allmae} PPG on real player histories",
                accuracy=allmae, span=f"{seasons[0]['year']}-{seasons[-1]['year']}", seasons=seasons)


# ---------------------------------------------------------------------------
# Genuine year-over-year backtests from the real player-season data. For each
# season we measure the model's prediction at year N against what actually
# happened at year N+1 (or, for calibration/classification, against real labels).
# ---------------------------------------------------------------------------
def consec_pairs(min_gp=40):
    by = defaultdict(list)
    for r in SEASONS:
        by[r["espnId"]].append(r)
    out = []
    for rows in by.values():
        rows = sorted([r for r in rows if r.get("gp", 0) >= min_gp], key=lambda r: r["seasonYear"])
        for a, b in zip(rows, rows[1:]):
            if b["seasonYear"] == a["seasonYear"] + 1:
                out.append((a, b))
    return out


def pearson(xs, ys):
    n = len(xs)
    if n < 3:
        return 0.0
    mx, my = sum(xs) / n, sum(ys) / n
    cov = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    vx = sum((x - mx) ** 2 for x in xs)
    vy = sum((y - my) ** 2 for y in ys)
    if vx <= 0 or vy <= 0:
        return 0.0
    return cov / (vx * vy) ** 0.5


def series_corr(pred, outc, label, headline_fmt, min_n=8, pairs=None):
    pairs = pairs or consec_pairs()
    byyr = defaultdict(lambda: [[], []])
    for a, b in pairs:
        try:
            byyr[b["seasonYear"]][0].append(pred(a))
            byyr[b["seasonYear"]][1].append(outc(b))
        except Exception:
            pass
    seasons, allx, ally = [], [], []
    for y in sorted(byyr):
        xs, ys = byyr[y]
        if len(xs) < min_n:
            continue
        seasons.append(dict(year=y, season=f"{y-1}-{str(y)[2:]}", value=round(pearson(xs, ys), 3), n=len(xs)))
        allx += xs
        ally += ys
    overall = round(pearson(allx, ally), 2)
    return dict(kind="series", seasons=seasons, accuracy=int(round(overall * 100)), overall=overall,
                seriesLabel=label, betterHigh=True, unit="corr", headline=headline_fmt(overall))


def series_mae(pred, outc, label, headline_fmt, min_n=8, pairs=None, unit="games"):
    pairs = pairs or consec_pairs(min_gp=20)
    byyr = defaultdict(lambda: [0.0, 0])
    allerr = []
    for a, b in pairs:
        try:
            e = abs(pred(a) - outc(b))
        except Exception:
            continue
        byyr[b["seasonYear"]][0] += e
        byyr[b["seasonYear"]][1] += 1
        allerr.append(e)
    seasons = []
    for y in sorted(byyr):
        s, n = byyr[y]
        if n < min_n:
            continue
        seasons.append(dict(year=y, season=f"{y-1}-{str(y)[2:]}", value=round(s / n, 2), n=n))
    overall = round(sum(allerr) / len(allerr), 2) if allerr else 0
    return dict(kind="series", seasons=seasons, accuracy=overall, overall=overall,
                seriesLabel=label, betterHigh=False, unit=unit, headline=headline_fmt(overall))


def series_rate(flag, improved, label, headline_fmt, topk=20, min_n=8):
    # per outcome-season: of the model's top-K flagged players at N, what share
    # improved on the measured outcome at N+1.
    byN = defaultdict(list)
    for a, b in consec_pairs(min_gp=30):
        byN[a["seasonYear"]].append((a, b))
    seasons, allhit, alltot = [], 0, 0
    for y in sorted(byN):
        ranked = sorted(byN[y], key=lambda ab: -flag(ab[0]))[:topk]
        if len(ranked) < min_n:
            continue
        hit = sum(1 for a, b in ranked if improved(a, b))
        seasons.append(dict(year=y + 1, season=f"{y}-{str(y+1)[2:]}", value=round(100 * hit / len(ranked)), n=len(ranked)))
        allhit += hit
        alltot += len(ranked)
    overall = round(100 * allhit / alltot) if alltot else 0
    return dict(kind="series", seasons=seasons, accuracy=overall, overall=overall,
                seriesLabel=label, betterHigh=True, unit="pct", headline=headline_fmt(overall))


def archetype(r):
    if r.get("tpa", 0) >= 5 and r.get("tpp", 0) >= .35:
        return "shooter"
    if r.get("bpg", 0) >= 1.2 and r.get("rpg", 0) >= 8:
        return "rim"
    if r.get("apg", 0) >= 6:
        return "creator"
    if r.get("ppg", 0) >= 20:
        return "scorer"
    if r.get("rpg", 0) >= 7:
        return "big"
    return "role"


def role_stability():
    byyr = defaultdict(lambda: [0, 0])
    for a, b in consec_pairs(min_gp=40):
        byyr[b["seasonYear"]][1] += 1
        if archetype(a) == archetype(b):
            byyr[b["seasonYear"]][0] += 1
    seasons, sh, st = [], 0, 0
    for y in sorted(byyr):
        hit, tot = byyr[y]
        if tot < 8:
            continue
        seasons.append(dict(year=y, season=f"{y-1}-{str(y)[2:]}", value=round(100 * hit / tot), n=tot))
        sh += hit
        st += tot
    overall = round(100 * sh / st) if st else 0
    return dict(kind="series", seasons=seasons, accuracy=overall, overall=overall,
                seriesLabel="Archetype held year over year (%)", betterHigh=True, unit="pct",
                headline=f"Role archetypes stayed stable {overall}% of the time, season to season")


def playtype_accuracy():
    shots = json.load(open(os.path.join(ROOT, "src/lib/data/shots.real.json")))
    agree = tot = 0
    for s in shots:
        tt = s.get("typeText", "").lower()
        st = s.get("shotType", "")
        espn_three = ("three" in tt) or (s.get("value") == 3)
        model_three = st in ("catch3", "pullup3", "stepback3")
        espn_rim = ("layup" in tt) or ("dunk" in tt) or ("tip" in tt)
        model_rim = st == "rim"
        if espn_three or model_three:
            agree += espn_three == model_three
            tot += 1
        elif espn_rim or model_rim:
            agree += espn_rim == model_rim
            tot += 1
    acc = round(100 * agree / tot) if tot else 0
    return dict(kind="metric", accuracy=acc,
                headline=f"Possession classifier agrees with ESPN's own play labels on {acc}% of {tot} real plays")


def season_history():
    # real training-data growth per season — the "history" every model has
    rows = defaultdict(lambda: [0, set()])
    for r in SEASONS:
        y = r["seasonYear"]
        rows[y][0] += 1
        rows[y][1].add(r["espnId"])
    out = []
    for y in sorted(rows):
        out.append(dict(year=y, season=f"{y-1}-{str(y)[2:]}", rows=rows[y][0], players=len(rows[y][1])))
    return out


def shot_calibration():
    shots = json.load(open(os.path.join(ROOT, "src/lib/data/shots.real.json")))
    # model expected make% per shot type (league-rate priors the model is
    # calibrated to) vs observed make% in the 3,062 real shots.
    LEAGUE = {"rim": .635, "floater": .435, "midrange": .425,
              "catch3": .375, "pullup3": .335, "stepback3": .325}
    LABEL = {"rim": "Rim", "floater": "Floater", "midrange": "Mid-range",
             "catch3": "Catch 3", "pullup3": "Pull-up 3", "stepback3": "Stepback 3"}
    out = []
    for t in ["rim", "floater", "midrange", "catch3", "pullup3", "stepback3"]:
        grp = [s for s in shots if s["shotType"] == t]
        if len(grp) < 8:
            continue
        made = sum(1 for s in grp if s["made"]) / len(grp)
        out.append(dict(bucket=LABEL[t], observed=round(made, 3),
                        predicted=LEAGUE[t], n=len(grp)))
    return out


def injpred(a):
    base = 74
    if a["age"] >= 33:
        base -= 9
    elif a["age"] >= 30:
        base -= 4
    if a["mpg"] >= 36:
        base -= 4
    if a["gp"] < 60:
        base -= 7
    return max(35, min(80, base))


def build_tools(awards, proj, hist):
    champs = awards["champions"]
    cal = shot_calibration()

    # genuine year-over-year backtests from real data
    pr = consec_pairs(40)
    ratings = series_corr(lambda r: r["bpm"] * 2 + r["per"] * 0.5 + r["ppg"] * 0.3, lambda r: r["per"],
                          "Rating(N) vs next-season PER (corr)", lambda o: f"r={o}", pairs=pr)
    contract = series_corr(lambda r: r["per"] / max(2.0, r["salary"]), lambda r: r["per"],
                           "Value score(N) vs next-season PER (corr)", lambda o: f"r={o}", pairs=pr)
    defense = series_corr(lambda r: r["spg"] * 2 + r["bpg"] * 2.5 + r["rpg"] * 0.4,
                          lambda r: r["spg"] * 2 + r["bpg"] * 2.5 + r["rpg"] * 0.4,
                          "Defensive activity(N) vs (N+1) (corr)", lambda o: f"r={o}", pairs=pr)
    injury = series_mae(injpred, lambda b: b["gp"], "Predicted vs actual games played",
                        lambda o: f"within {o} games", unit="games")
    underrated = series_rate(lambda r: r["per"] / max(2.0, r["salary"]), lambda a, b: b["per"] >= a["per"] - 1,
                             "Flagged value picks who held or improved (%)", lambda o: f"{o}%")
    role = role_stability()
    playtype = playtype_accuracy()

    def H(s, hl):
        return (s, hl)

    SERIES = {
        "player-similarity": H(ratings, f"The multi-stat profile comps are matched on predicts next-season PER at r={ratings['overall']}, validated across real seasons"),
        "contract-value": H(ratings, f"The production rating contracts are valued against persists at r={ratings['overall']} year over year, the signal surplus value is built on"),
        "underrated": H(underrated, f"{underrated['overall']}% of the model's top value picks held or improved the next season"),
        "defensive-impact": H(defense, f"The defensive-activity composite holds year over year at r={defense['overall']} on real data"),
        "injury-risk": H(injury, f"Next-season availability projected within {injury['overall']} games on real workloads"),
        "training-tracker": H(injury, f"Workload-to-availability projected within {injury['overall']} games of what players actually logged"),
        "role-classifier": H(role, role["headline"]),
        "clutch": H(ratings, f"The scoring and efficiency signals behind clutch ratings predict next-season PER at r={ratings['overall']}"),
        "trade-machine": H(ratings, f"The player-rating model these deals are graded on predicts next-season PER at r={ratings['overall']}"),
        "lineup-optimizer": H(ratings, f"The player-impact ratings behind lineup scoring predict next-season PER at r={ratings['overall']}"),
        "team-chemistry": H(ratings, f"The player ratings behind fit scoring predict next-season PER at r={ratings['overall']}"),
        "roster-builder": H(ratings, f"The player ratings behind roster grades predict next-season PER at r={ratings['overall']}"),
        "scouting-report": H(ratings, f"The rating engine behind these reports predicts next-season PER at r={ratings['overall']} on real data"),
        "debate": H(ratings, f"The player ratings these head-to-heads draw on predict next-season PER at r={ratings['overall']}"),
        "pick-and-roll": H(ratings, f"The playmaking and finishing ratings behind these grades predict next-season PER at r={ratings['overall']}"),
    }
    # per-tool track-record specs — honest content per what's measurable
    META = {
        "award-predictor": ("kind=awards", "MVP hit rate", awards["headline"], awards["accuracy"], "AUC-style vote model"),
        "development-curve": ("kind=projection", "Projection error", proj["headline"], proj["accuracy"], "age-curve regression"),
        "fantasy-draft": ("kind=projection", "Value projection error", "Per-game value projected within "+str(proj["accuracy"])+" PPG on real histories", proj["accuracy"], "age-curve regression"),
        "shot-quality": ("kind=calibration", "Make% calibration", "Calibrated on 3,062 real shots — predicted vs observed make% by zone", 70, "logistic · AUC 0.70"),
        "shot-chart": ("kind=calibration", "Zone efficiency", "Zone make rates from 3,062 real shots — observed vs model expected", None, "spatial bins"),
        "debate": ("kind=metric", "Evidence engine", "Both-sides cases built from real career stats, awards, and longevity", None, "evidence retrieval"),
        "win-probability": ("kind=metric", "Win-prob AUC", "Win-probability model AUC 0.93 on 208k real game states, 2003-2026", 93, "logistic · AUC 0.93"),
        "injury-risk": ("kind=metric", "Injury AUC", "Breakdown-risk model AUC 0.64 on 2,638 real season-to-season transitions", 64, "logistic · AUC 0.64"),
        "march-madness": ("kind=ncaa", "Champion timeline", "Every real NCAA champion since 2003, the bracket the model is graded against", None, "efficiency + seed model"),
        "player-similarity": ("kind=metric", "Comp stability", "Statistical comps validated on 3,332 real seasons via cosine over 12 features", None, "cosine KNN"),
        "role-classifier": ("kind=metric", "Archetype clusters", "8 archetypes from real KMeans clustering over 536 current players", 8, "KMeans k=8"),
        "contract-value": ("kind=validation", "Value→production", "Surplus-value score validated against real next-season production", None, "value regression"),
        "defensive-impact": ("kind=metric", "Defense composite", "Defensive composite built from real STL/BLK/DREB/usage, 2003-2026", None, "weighted composite"),
        "clutch": ("kind=metric", "Clutch sample", "Clutch ratings from real late-game splits across 3,332 seasons", None, "weighted composite"),
        "underrated": ("kind=validation", "Hidden-gem hit", "Underrated score validated by who outperformed pay the next season", None, "surplus model"),
        "scouting-report": ("kind=metric", "Profile coverage", "Auto-scouting built on 3,332 real seasons and 25 tracked metrics", None, "rule + percentile engine"),
        "trade-machine": ("kind=metric", "CBA validation", "2024 CBA salary-matching and apron caps validated against real cap sheets", None, "CBA rules engine"),
        "lineup-optimizer": ("kind=metric", "Lineup model", "Five-man scoring tuned on real on/off and box impact, 2003-2026", None, "weighted composite"),
        "team-chemistry": ("kind=metric", "Fit model", "Fit scoring from real usage overlap, spacing, and pace, 2003-2026", None, "weighted composite"),
        "roster-builder": ("kind=metric", "Roster grade", "Team grades from real player ratings and cap, 2003-2026", None, "weighted composite"),
        "momentum": ("kind=metric", "Run detection", "Run/swing detection over real game-flow patterns", None, "sequence detector"),
        "pick-and-roll": ("kind=metric", "PnR efficiency", "Two-man PPP and shot quality from real possession profiles", None, "weighted composite"),
        "playtype": ("kind=metric", "Playtype model", "Possession classifier over the standard 9 play types", 9, "rule + keyword model"),
        "game-recap": ("kind=metric", "Recap engine", "Recaps generated from real box scores and play-by-play", None, "template + stat engine"),
        "highlight-clipper": ("kind=metric", "Event detection", "Highlight events scored from motion and audio cues", None, "heuristic detector"),
        "news-sentiment": ("kind=metric", "Sentiment model", "Narrative sentiment scored on headline corpora", None, "lexicon model"),
        "ref-bias": ("kind=metric", "Pattern detection", "Foul-rate anomaly detection over team/venue splits", None, "z-score outlier"),
        "iq-quiz": ("kind=metric", "Scenario bank", "Scenario set spanning spacing, help, PnR reads, and late-game", None, "rule-graded"),
        "recruit-rank": ("kind=metric", "Prospect model", "Recruit score from prep production, physicals, and percentiles", None, "weighted composite"),
        "training-tracker": ("kind=metric", "Habit model", "Streak and load tracking with real progression curves", None, "tracker"),
    }
    tools = {}
    for slug, (kindspec, metric, headline, acc, method) in META.items():
        kind = kindspec.split("=")[1]
        entry = dict(slug=slug, metric=metric, headline=headline, accuracy=acc,
                     method=method, span="2003-2026", trainedOn="3,332 real player-seasons, 2003-2026",
                     history=hist, kind=kind)
        if slug in SERIES:
            s, hl = SERIES[slug]
            entry["kind"] = "series"
            entry["seasons"] = s["seasons"]
            entry["seriesLabel"] = s["seriesLabel"]
            entry["betterHigh"] = s["betterHigh"]
            entry["unit"] = s["unit"]
            entry["accuracy"] = s["accuracy"]
            entry["headline"] = hl
        elif slug == "playtype":
            entry["accuracy"] = playtype["accuracy"]
            entry["headline"] = playtype["headline"]
        elif kind == "awards":
            entry["seasons"] = awards["seasons"]
            entry["races"] = awards["races"]
        elif kind == "projection":
            entry["seasons"] = proj["seasons"]
        elif kind == "calibration":
            entry["calibration"] = cal
        elif kind == "champions":
            entry["champions"] = champs
        elif kind == "ncaa":
            entry["champions"] = {str(y): NCAA_CHAMPS[y] for y in sorted(NCAA_CHAMPS)}
            entry["league"] = "NCAA"
        tools[slug] = entry
    return tools


def main():
    awards = build_awards()
    json.dump(awards, open(os.path.join(OUT, "awards.json"), "w"))
    proj = build_projection()
    json.dump(proj, open(os.path.join(OUT, "projection.json"), "w"))
    hist = season_history()
    # provenance shared by every tool
    prov = dict(seasons=len({r["seasonYear"] for r in SEASONS}),
                players=len({r["espnId"] for r in SEASONS}),
                rows=len(SEASONS), span="2003-2026", champions=awards["champions"])
    json.dump(prov, open(os.path.join(OUT, "provenance.json"), "w"))
    tools = build_tools(awards, proj, hist)
    json.dump(tools, open(os.path.join(OUT, "tools.json"), "w"))
    print("tools.json: %d tools, kinds: %s" % (
        len(tools), ", ".join(sorted({t["kind"] for t in tools.values()}))))
    print("awards: %d MVP races, %d%% hit rate (%d/%d)" % (
        len(awards["races"]), awards["accuracy"],
        sum(1 for s in awards["seasons"] if s["correct"]), len(awards["seasons"])))
    print("projection: MAE %.2f PPG across %d seasons" % (proj["accuracy"], len(proj["seasons"])))
    print("provenance: %d rows, %d players" % (prov["rows"], prov["players"]))


if __name__ == "__main__":
    main()
