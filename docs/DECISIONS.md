# Decisions & Assumptions Log

Append-only. Each entry has the date, the decision, why, and the alternatives considered. This is the source material for
`ARCHITECTURE.md` (tradeoffs table and assumptions section).

## 2026-10-03: Tech stack

- **Decision:** Python (DuckDB/pyarrow) preprocessing → static JSON; Vite + React + TypeScript frontend with Canvas; Netlify hosting.
- **Why:** No backend to run or pay for. Preprocessing makes the browser fast and keeps parquet parsing out of the client. Canvas handles thousands of points and paths smoothly during playback.
- **Alternatives:** Streamlit (fastest to build, but playback and UX would be clunky); Next.js with API routes (more moving parts than needed); parsing parquet in the browser with duckdb-wasm (heavy first load).

## 2026-10-03: Processed data committed to the repo

- **Decision:** Pipeline output in `web/public/data/` is committed; raw data in `data/raw/` is gitignored.
- **Why:** Netlify deploys static files directly, with no Python needed at build time.
- **Revisit if:** the output size gets large (>~50MB).

## 2026-10-03: Raw data stays in the repo

- **Decision:** The raw `player_data/` that was already pushed in the first commit stays in git history (owner's call). The
  working copy now lives in `data/raw/player_data/`; new commits don't re-add it.

## 2026-10-03: Data format = one columnar JSON per map

- **Decision:** `index.json` (maps, dates) plus `<Map>.json` with `matches[]`, `journeys[]` (a [start,end) row slice each) and
  columnar `rows {t,u,v,e,n}`. The browser loads one map at a time (0.16–1.46MB raw, gzipped by Netlify).
- **Why:** One fetch per map gives instant filtering and playback in memory. Columnar arrays are about 3× smaller than an
  array of objects. Coordinates are pre-converted to UV in the pipeline, so the browser never sees world coordinates.
- **Alternatives:** One file per match (796 requests; the aggregate heatmaps would need all of them anyway). duckdb-wasm
  in the browser (multi-MB runtime, slow first load). Binary/Arrow (smaller, but opaque and harder to debug for a 4MB dataset).

## 2026-10-03: Rendering = Canvas 2D, no map/chart library

- **Decision:** A hand-written canvas renderer with pan/zoom, a custom heatmap (256² grid, Gaussian blur, sqrt scaling),
  and markers drawn by one function that the legend reuses.
- **Why:** About 60k points and 836 paths redraw smoothly. Leaflet or deck.gl would bring tile and geo concepts that a flat
  minimap doesn't need. The renderer is about 250 lines and fully under our control.

## 2026-10-03: Match date = source folder, not UTC date of `ts`

- **Decision:** Each match's "day" is its folder (Feb_10…14). The real UTC start is shown in tooltips and rows.
- **Why:** A few matches start minutes before UTC midnight (e.g. 23:58 Feb 9 sits in Feb_10). The dataset defines its
  days by folder; using UTC dates would invent a "Feb 9" day.

## 2026-10-03: UX defaults

- **All matches view:** traffic heatmap on, paths off, small kill/death/storm markers. Answers "where do people go and
  fight" at a glance. **Single match:** paths on, heatmap off, framed to the match, with playback at 10×. Switching
  between the two applies these presets.
- Loot markers are off by default (about 10k dots drown everything else); there is a loot heatmap instead.
- Map, day and match live in the URL hash, so a designer can share a link to an exact view.

## Assumptions about the data

Found during `/inspect-data` on 2026-10-03.

| # | What we ran into | Evidence | What we decided |
|---|---|---|---|
| A1 | README says `ts` is "milliseconds of in-match time". | The raw values (~1.77e9) read as Unix **seconds** give exactly Feb 10–14 2026, matching the folders. Match length is a median of 6.4 min with a max of 14.8, and positions are sampled about every 5 s. | Treat `ts` as Unix seconds of real UTC time. Playback uses seconds since match start. |
| A2 | README says the minimaps are 1024×1024. | They measure 4320², 2160×2158 and 9000². | Compute in UV (0–1), then scale by the real image dimensions (resized for the web). |
| A3 | README says a numeric ID means bot. | 17 files with numeric IDs (1379, 1402, 1429) emit `Position`/`Loot`, which are human events. ID 1429 is a bot in other files. | Classify each file by its event stream (`BotPosition` → bot, `Position` → human); the ID is a fallback. |
| A4 | Identical Loot rows. | 1,253 extra copies, up to 7 at the same stamp and position. | Treat them as several items looted at once. Keep the count and render one marker ×N. |
| A5 | Identical Position rows. | 210 extra copies. | Drop them as logging duplicates. |
| A6 | One (user, match) appears in two day folders. | `ac049b28…`: the Feb_10 file (88 rows) is a subset of the Feb_11 file (271 rows), around 23:51–23:57 UTC on Feb 10. | Merge by (user_id, match_id), dedupe, and date the match by its start time. |
| A7 | Most matches have only one recorded journey. | 743/796 matches have 1 file; the max is 16. | The data looks like a sample of players, not full lobbies. The UI says "recorded players" (not "all players"), and insights lean on aggregates. |
| A8 | README calls it both "battle-royale" and "extraction shooter". | — | Extraction shooter (as the assignment says). No technical impact. |
| A10 | Identical BotKill/BotKilled rows. | 39 + 3 extra copies at the same second and position. | Treated like loot: real multiples (e.g. a multi-kill), counted via `n`. |
| A11 | x/z are float32. | Rounding float32 gave values like 0.21729999780654907. | Cast to DOUBLE before converting to UV and rounding to 4 decimals (≈0.2px). This halved the JSON size. |
| A9 | The event perspective in bot files is unclear. | Bot files contain `BotKill`/`BotKilled`; the README defines these from the human's side. | Read events from the file owner's perspective: in a bot's file, `BotKilled` = this bot died. To be confirmed when rendering. |
