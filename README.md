# 🏀 CourtCommand

### The ultimate AI-powered basketball intelligence engine.

CourtCommand is a premium NBA analytics command center that packs **30 distinct basketball tools** into one cohesive, design-forward web app — shot-quality prediction, player-similarity search, a cap-legal trade machine, lineup optimization, clutch ratings, award projections, and much more. A global natural-language **command bar (⌘K)** routes any question — _"Find underrated 3&D wings under $15M"_, _"Is Luka better than SGA offensively?"_, _"Build the best Lakers lineup"_ — to the right tool instantly.

Every panel is computed live by a deterministic analytics engine over **real, league-wide data** — every rostered NBA player (500+), with real per-game stats, real salaries, real bios and headshots, and real team records, ingested from ESPN's public APIs by [`scripts/ingest-espn.mjs`](scripts/ingest-espn.mjs). It also ships a built-in **Betting** section — the EdgeBoard prop-edge model — and ML models that run live in the browser. Nothing is a screenshot.

---

## ✨ Highlights

- **30 fully-interactive tools**, each with its own page, filters, animated loading states, charts, tables, explanations, and shareable URLs.
- **Global AI command bar** — natural-language routing with confidence scoring and player extraction (`src/lib/engine/command.ts`).
- **Custom SVG chart kit** — radar, bar, line (with confidence bands), gauge, and an animated basketball **half-court** for shot charts. Zero charting dependencies.
- **Editorial-terminal aesthetic** — flat near-black surfaces, hairline borders, square corners, a single restrained accent, serif display type, and data-first layouts.
- **Real CBA logic** — the trade machine enforces 2024 salary-matching, apron hard-caps, and grades roster impact.
- **Typed, production-grade architecture** — clean engine/data/UI separation; `npx tsc` clean; production build prerenders all 35 routes.

---

## 🧰 The 30 tools

| # | Tool | What it does |
|---|------|--------------|
| 1 | **Shot Quality Predictor** | Grade a shot's expected value from type, defender distance, clock, and rhythm |
| 2 | **Player Similarity (HoopRadar)** | Find statistical twins by playstyle, usage, shooting, and defense |
| 3 | **Fantasy Draft Assistant** | 9-cat z-score board with punt strategies and scarcity |
| 4 | **Trade Machine** | Cap-legal multi-player trades with apron checks + impact grades |
| 5 | **Clutch Dashboard (ClutchGene)** | Rank late-game performers by poise, difficulty, and volume |
| 6 | **March Madness Predictor** | Simulate the bracket from efficiency, seeding, SOS, form, upsets |
| 7 | **RefBias Analyzer** | Home/away foul-rate and star-whistle patterns by team |
| 8 | **Lineup Optimizer** | Best 5-man unit by spacing, defense, scoring, playmaking, balance |
| 9 | **Injury Risk Predictor** | Risk from workload, age, minutes, rest, and back-to-backs |
| 10 | **Win Probability Tracker** | Live win odds from margin, time, possession, strength |
| 11 | **Highlight Auto-Clipper** | Detect moments from motion + crowd-audio + event cues |
| 12 | **RecruitRank** | Prep stats → star rating, national rank, scouting report |
| 13 | **Contract Value Analyzer** | Bargains vs overpays: production vs salary, age, availability |
| 14 | **PlayType Classifier** | PnR / iso / transition / post-up / spot-up / cut mix |
| 15 | **Team Chemistry Simulator** | Roster fit from usage overlap, spacing, defense, positional need |
| 16 | **Momentum Tracker** | Runs, timeout swings, and quarter-by-quarter margin |
| 17 | **Development Curve Predictor** | Age-curve growth projection with confidence band + comp |
| 18 | **Shot Chart Generator** | Interactive court: makes, misses, hot zones, expected points |
| 19 | **Debate Evidence Finder** | Evidence-backed cases for both sides of any matchup |
| 20 | **Role Classifier** | Cluster players into archetypes (3&D, rim protector, creator…) |
| 21 | **Training Tracker** | Log reps/conditioning, streaks, goals, and progress charts |
| 22 | **AI Scouting Report** | Strengths, weaknesses, role, comp, development priorities |
| 23 | **Game Recap Auto-Writer** | Box score → ESPN-style recap with player of the game |
| 24 | **Pick-and-Roll Analyzer** | Handler/roll-man duos by PPP, turnovers, shot quality |
| 25 | **News Sentiment Tracker** | Media narrative trend over time with headline feed |
| 26 | **Award Predictor** | MVP / DPOY / ROTY / 6MOY vote-share projections |
| 27 | **Roster Builder Game** | GM mode: build under the cap, score the roster |
| 28 | **Defensive Impact Dashboard** | Rim protection, perimeter D, opponent FG%, on/off |
| 29 | **Basketball IQ Quiz** | Scenario-based offense/defense decision quiz |
| 30 | **Underrated Player Finder** | Overlooked value: efficiency, plus-minus, cheap, low-noise |

---

## 🚀 Getting started

```bash
cd projects/courtcommand
npm install
npm run dev          # → http://localhost:3000

npm run build        # production build (prerenders all routes)
npm start            # serve the production build
npx tsc --noEmit     # typecheck
```

Press **⌘K / Ctrl-K** anywhere to open the command bar.

---

## 🏗️ Architecture

```
src/
├── app/
│   ├── page.tsx                 # animated hero + live previews + tool grid
│   ├── tools/page.tsx           # filterable arsenal of all 30 tools
│   ├── tools/<slug>/page.tsx    # one page per tool (30)
│   └── api/                     # JSON API seam for a live feed
│       ├── players/route.ts
│       ├── players/[id]/route.ts
│       └── awards/route.ts
├── components/
│   ├── chrome/                  # header, footer
│   ├── command/                 # ⌘K command-bar provider + palette
│   ├── home/                    # hero, live preview cards
│   ├── tool/ToolShell.tsx       # shared tool page chrome (Panel, Insight)
│   └── ui/                      # GlassCard, Gauge, Meter, RadarChart,
│                                #   BarChart, LineChart, CourtChart,
│                                #   PlayerPicker, Controls, Analyze, Reveal
├── lib/
│   ├── data/                    # players, teams, derived metrics  ← SOURCE OF TRUTH
│   ├── engine/                  # all 30 algorithms (pure functions)
│   │   ├── players.ts           # similarity, clutch, contract, role, scouting…
│   │   ├── teams.ts             # trade, lineup, chemistry, PnR, momentum…
│   │   ├── game.ts              # shot quality, win prob, shot chart, recap…
│   │   ├── content.ts           # fantasy, bracket, debate, sentiment, quiz…
│   │   └── command.ts           # natural-language router
│   ├── tools.ts                 # the 30-tool registry (nav, grid, routing)
│   └── cn.ts                    # classnames + accent + grade helpers
db/schema.sql                    # Postgres/Supabase schema
scripts/seed.ts                  # emit db/seed.sql + db/seed.json from mock data
```

**Data flow:** `lib/data` (raw stat lines + derived metrics) → `lib/engine` (pure analytic functions) → tool pages render the results with the shared UI kit. State is local to each tool; there is no global store to fight.

### Design system

| Token | Value |
|-------|-------|
| Display font | **Newsreader** (serif) |
| Body / UI font | **Archivo** |
| Stat / mono font | **IBM Plex Mono** |
| Accent / secondary | `#E0561F` accent · `#7E8CA0` steel · muted semantic grade colors |
| Surfaces | flat `#0b0b0c` with hairline borders, square corners — no gradients or glows |

---

## 🧠 Trained models

Five models are trained over **22 seasons (2003-04 → 2024-25)** by a real scikit-learn
pipeline in [`model/`](model/), then exported as JSON and consumed for live, in-browser
inference (`src/lib/model/`) — no Python at runtime. Several tools display a **Trained
model** provenance badge with the model type and held-out test metric.

| Model | Type | Trained on | Test metric | Drives |
|-------|------|-----------|-------------|--------|
| Shot Quality | Logistic regression | 320k shots | **AUC 0.70** | Shot Quality Predictor |
| Win Probability | Logistic regression | 208k game states | **AUC 0.93 · Brier 0.107** | Win Probability Tracker |
| MVP Share | Linear regression | 9.5k player-seasons | **R² 0.81** | Award Predictor |
| Injury Risk | Logistic regression | 9.5k player-seasons | **AUC 0.66** | Injury Risk Predictor |
| Archetypes | K-Means (k=8) | 9.5k player-seasons | 8 clusters | Role Classifier |

```bash
# Re-train end-to-end (installs into model/.venv, writes model/exports/*.json)
python3 -m venv model/.venv && model/.venv/bin/pip install -r model/requirements.txt
model/.venv/bin/python model/train.py
```

The micro-data is **synthetic-historical** — calibrated to documented league trends
(3PA share 0.18→0.40, TS% 0.52→0.58, pace dip-then-rise, cross-checked against
FiveThirtyEight's public data) because `stats.nba.com` is unreachable in this
environment. `model/train.py` includes a live-data fetch path; point it at a real
feed and re-run to retrain on actual play-by-play. Learned parameters live in
`src/lib/model/params/` and the inference functions in `src/lib/model/index.ts`.

## 🔌 Plugging in real NBA data

The entire app reads from `src/lib/data`. To go live:

1. Create the tables in [`db/schema.sql`](db/schema.sql) (Postgres / Supabase).
2. Seed them: `npx tsx scripts/seed.ts` then load `db/seed.sql` — or point the seed source at a live provider (e.g. `nba_api`, Sportradar).
3. Swap the imports in `src/app/api/*` (and optionally `src/lib/data`) to read from the DB. The engine functions and all 30 UIs are unchanged because they depend only on the typed `Player` / `Team` shapes.

The API routes already exist as the seam:

```
GET /api/players?q=curry        GET /api/players/:id        GET /api/awards?kind=MVP
```

---

## 🛠️ Tech stack

**Next.js 15 (App Router)** · **React 19** · **TypeScript** · **Tailwind CSS** · **lucide-react** · custom SVG chart engine · real ESPN data ingestion · in-browser ML inference.

### Real data

`scripts/ingest-espn.mjs` pulls every NBA team roster, each player's real per-game
season stats (and full 2003–present history), real salaries + salary history, real
bios, and real team records from ESPN's public endpoints — no API key. Output lands in
`src/lib/data/players.real.json` (500+ players), `teams.real.json`, and
`model/data/real_seasons.json` (3,300+ real player-seasons used to train models).
Headshots and team logos come straight from ESPN's CDN. Re-run the script to refresh.

### Betting · EdgeBoard

The `/betting` section ports the EdgeBoard prop-edge model: a recency-blended
projection, a normal-CDF P(over), context adjustments, an edge over the book line, and a
Poisson-binomial lineup optimizer with PrizePicks power/flex and demon/goblin payouts.
Engine in `src/lib/engine/betting.ts`. For analysis only — not betting advice.

### Design language

A restrained, editorial **terminal** aesthetic — built to read as a serious analytics product, not a templated landing page.

- **Typography** — **Newsreader** (serif) for display headlines, **Archivo** for UI, **IBM Plex Mono** for tabular figures.
- **Surfaces** — flat near-black `#0b0b0c` with **hairline** borders and **square** corners. No gradients, no glows, no blur-glass.
- **Color** — one restrained accent (`#E0561F`) plus a steel secondary and muted, *semantic* data colors. Team brand colors are used only where they carry meaning.
- **Data-first** — every screen leads with real tables, charts, and figures rendered instantly (no decorative entrance animation); interactions are limited to hover, filters, and the command bar.

> Built as a showcase of full-stack product design — clean architecture, a real analytics engine, and resume-quality polish across every one of 30 modules.
