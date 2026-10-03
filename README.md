# LILA BLACK — Player Journey Visualization Tool

A browser tool for Level Designers to see how players move, fight, loot and die on LILA BLACK's maps, built from
5 days of production telemetry (10–14 Feb 2026, 796 matches, 89k events).

**Live:** _deployment URL goes here_

## What you can do

- **Pick a map and day.** Ambrose Valley, Grand Rift and Lockdown, for any of the 5 days or all combined.
- **See where things happen.** Heatmaps for traffic (where players spend time), kills, deaths, storm deaths and loot.
- **Tell humans from bots.** Humans are blue solid paths and round markers; bots are orange dashed paths and square markers.
- **Read the events.** Kills (⊕), deaths (✕), storm deaths (◆) and loot (•) are distinct markers. Hover any marker for
  details: who, what, and when in the match.
- **Watch a match.** Select a match to frame it on the map, then press play (or Space). The timeline shows tick marks
  where fights happen, so you can jump straight to them. Speeds go from 1× to 50×.
- **Share a view.** The map, day and match are kept in the URL.

Pan with drag, zoom with the scroll wheel or the +/− buttons, and double-click to reset.

## Tech stack

| Part | Choice |
|---|---|
| Data pipeline | Python 3.12 + DuckDB (managed by `uv`), Pillow for minimaps |
| Frontend | React 19 + TypeScript + Vite, Canvas 2D rendering (no map/chart library) |
| Hosting | Netlify (static site, no backend) |

Why these choices, how the data flows, and how coordinates are mapped: see [ARCHITECTURE.md](ARCHITECTURE.md).
The full decision and assumption log is in [docs/DECISIONS.md](docs/DECISIONS.md).

## Run locally

Requirements: Node ≥ 22, pnpm, and [uv](https://docs.astral.sh/uv/) (only to rebuild the data).

```bash
# Web app (the processed data is already committed)
cd web
pnpm install
pnpm dev            # http://localhost:5173
```

Rebuild the data from the raw parquet files (only needed if the pipeline changes):

```bash
# Raw files go in data/raw/player_data/ (February_10 … February_14, minimaps/, README.md)
cd pipeline
uv run python build.py                 # writes web/public/data/*.json and web/public/maps/*.webp
uv run python debug/verify_coords.py   # optional: renders all points over each minimap for a visual check
```

Other commands: `pnpm -C web typecheck`, `pnpm -C web lint`, `pnpm -C web build`.

**Environment variables:** none.

## Deploy

`netlify.toml` builds `web/` with `pnpm build` and publishes `web/dist`. Connect the GitHub repo in Netlify, or run
`npx netlify deploy --prod` from the repo root. No Python is needed at deploy time.

## Repository layout

```
pipeline/         Python: raw parquet → cleaned per-map JSON + web minimaps
web/              React app (src/map = rendering, src/ui = panels, src/data = loading/types)
web/public/data/  generated dataset (committed)
data/raw/         original telemetry (not committed going forward)
docs/             assignment, decision log
```
