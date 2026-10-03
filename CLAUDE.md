# LILA BLACK — Player Journey Visualization Tool

Take-home assignment for the LILA Games Product Engineer role. We're building a hosted, browser-based tool
that Level Designers use to see how players move, fight, loot, and die on the maps of LILA BLACK
(an extraction shooter), using 5 days of production telemetry.

- Full spec: `docs/ASSIGNMENT.md`. **Do not read** `Product Engineer- Written Test- LILA.md`, an 845KB copy with base64 images.
- Decision and assumption log: `docs/DECISIONS.md`. Append to it whenever you make a non-obvious choice.
- Graded on: system design, attention to detail, end-to-end execution, product thinking, code quality, and communication.
  **Quality over quantity:** 4 polished features beat 10 half-working ones.

## Users

Level Designers, not data scientists. Every UI decision should favor clarity: readable legends, sensible defaults
(load something useful immediately), no jargon such as raw column names or epoch timestamps, and fast interaction.

## Architecture

```
data/raw/player_data/  LILA telemetry (parquet files named *.nakama-0, minimaps, README). READ-ONLY, gitignored
pipeline/         Python (DuckDB/pyarrow): parquet → compact per-match JSON + indexes
web/              Vite + React + TypeScript static app (Canvas rendering)
web/public/data/  pipeline output, committed so Netlify serves it statically
docs/             ASSIGNMENT.md, DECISIONS.md
ARCHITECTURE.md   deliverable: one page
INSIGHTS.md       deliverable: 3 insights with evidence
README.md         deliverable: stack, setup, env vars, deployed URL
```

- No backend. Preprocess once, then serve static files. Hosting: **Netlify** (static deploy from GitHub).
- All world→minimap coordinate math lives in **one** module per side (pipeline and web). Never inline it elsewhere.
- Large datasets render on `<canvas>`, not as thousands of SVG/DOM nodes.

## Commands

- Rebuild data (run after any pipeline change): `cd pipeline && uv run python build.py`
  (uv-managed Python 3.12; system Python is 3.9). Writes `web/public/data/*.json` and `web/public/maps/*.webp`.
- Verify coordinates: `cd pipeline && uv run python debug/verify_coords.py`, then Read `pipeline/debug/out/*.png`.
- Python lint/format: `cd pipeline && uv run ruff check . && uv run ruff format .`
- Web dev server: `pnpm -C web dev` (http://localhost:5173)
- Typecheck / lint / build: `pnpm -C web typecheck`, `pnpm -C web lint`, `pnpm -C web build`
- TypeScript is pinned to 6.x: typescript-eslint doesn't support TS 7 yet. Don't upgrade it.
- Browser testing: the automation tab is often *hidden*, so rAF and ResizeObserver don't fire until a screenshot
  is taken. Check state with JS (`getImageData`, DOM text) rather than trusting a single screenshot.

## Code map

- `pipeline/config.py`: map scale/origin, event codes (must match `web/src/data/events.ts`)
- `pipeline/coords.py`: world → UV (the only place the formula lives in Python)
- `pipeline/build.py`: clean, dedupe, classify bots, and write per-map columnar JSON
- `web/src/map/viewport.ts`: UV ↔ screen, pan/zoom (the only coordinate math in the browser)
- `web/src/map/draw.ts`: canvas rendering of the map, heatmap, paths, markers and player heads
- `web/src/map/heatmap.ts`: grid binning, Gaussian blur, colour ramp
- `web/src/App.tsx`: state (map/day/match/layers/heatmap), derived views, URL hash sync
- `web/src/ui/*`: Sidebar, Timeline, Legend

## Data gotchas (CRITICAL; graded explicitly)

Verified against the real data on 2026-10-03. The source README (`data/raw/player_data/README.md`) is **wrong in places**.
Trust this section over the README. Full reasoning is in `docs/DECISIONS.md`.

- **Files:** parquet with no extension, `February_DD/{user_id}_{match_id}.nakama-0`. Each file is one player in one match.
  Totals: 89,104 rows, 1,243 files, 339 users, 796 matches, 3 maps. No nulls.
- **Event column** is BLOB. Decode it as utf-8 (DuckDB: `decode(event)`). The 8 values are `Position`, `BotPosition`, `Loot`,
  `BotKill`, `BotKilled`, `KilledByStorm`, `Kill`, `Killed`.
  - PvP is almost absent: 3 Kill / 3 Killed. Combat is mostly vs bots (2,415 BotKill, 700 BotKilled). There are only 39 storm deaths.
- **Timestamps (README WRONG):** `ts` is typed timestamp(ms), but the raw number is **Unix epoch SECONDS** of real
  wall-clock time (UTC). Real time is `to_timestamp(epoch_ms(ts))`. Proof: the dates match the folder names exactly, matches last
  0.2–15 min (median 6.4), and positions are sampled about every 5 s. For playback use `t = real_seconds - match_start`.
- **Date:** the folder name is the date. A few rows near UTC midnight fall into the neighboring folder.
- **Bots (README rule mostly holds):** a numeric `user_id` means bot, a UUID means human. But 17 numeric-ID files (IDs 1379, 1402, 1429)
  emit human-style `Position`/`Loot` events, and ID 1429 is a bot in other files. **Classify per file by event stream:**
  `BotPosition` means bot, `Position` means human. Use the ID only as a fallback. Logged as an assumption.
- **Coordinates:** use `x`,`z` (`y` is elevation). `u=(x-ox)/scale`, `v=(z-oz)/scale`, `px=u*W`, `py=(1-v)*H`.
  scale/ox/oz: AmbroseValley 900/-370/-473 · GrandRift 581/-290/-290 · Lockdown 1000/-500/-500.
  **README WRONG on image size:** the minimaps are NOT 1024. AmbroseValley 4320², GrandRift 2160×2158 (not square),
  Lockdown 9000². Work in UV (0–1) and multiply by the real image size. All 89k points fall inside 0–1 UV.
  Still to verify visually: `/verify-coords`.
- **Duplicates:** 210 exact-duplicate Position rows (drop). 1,253 duplicate Loot rows, up to 7 identical copies at the same
  stamp. Treat these as multiple items picked up at once: keep the count and render one marker as "×N".
- **Split match:** match `ac049b28…` (one user) has a file in BOTH Feb_10 and Feb_11. The Feb_10 file (88 rows) is a subset of
  the Feb_11 file (271 rows). Merge by (user_id, match_id) and dedupe.
- **Sparse matches (product-critical):** 743 of 796 matches contain just ONE recorded journey. The max is 16. "Match playback"
  usually means one player's run. Aggregate views (heatmaps across many matches) carry most of the insight.
- **Minimap files are huge** (2.9–12MB). Resize and compress them for the web.

## Conventions

- TypeScript strict mode, no `any`. Functional React components and hooks.
- Keep state small and explicit: filters (map/date/match), playback time, and layer toggles.
- Python: type hints, small pure functions, and a single `build.py` entry point that can be rerun safely.
- Name things in Level Designer language in the UI ("Storm death", not `event_type=3`).
- Don't add dependencies casually. Justify anything heavy in `docs/DECISIONS.md`.

## Rules

- Never modify `data/raw/`. A hook blocks it.
- Never `cat` or print parquet files or large JSON. Query with DuckDB and `LIMIT` (see `/inspect-data`).
- Coordinate changes must be re-verified visually with `/verify-coords` before you say they work.
- UI changes: run the app and check it in the browser. "It compiles" is not done.
- Record every assumption about ambiguous data in `docs/DECISIONS.md`. It feeds ARCHITECTURE.md.
- Before submission, run `/submission-check`.
