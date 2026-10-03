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
data/raw/         unzipped player_data.zip (parquet + minimaps + README). READ-ONLY, gitignored
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

> Fill these in for real when each part is scaffolded.

- Pipeline: `uv run python pipeline/build.py`. Needs `uv`, because system Python is 3.9. Target Python 3.12.
- Web dev: `pnpm -C web dev`
- Typecheck: `pnpm -C web exec tsc -b`
- Lint: `pnpm -C web lint`
- Build: `pnpm -C web build`

## Data gotchas (CRITICAL; graded explicitly)

> TODO: fill these in from `data/raw/README*` once `player_data.zip` is unzipped into `data/raw/`. Run `/inspect-data` first.

- [ ] **Coordinate mapping:** world bounds per map, axis orientation, Y-flip, scale/offset. Verify with `/verify-coords`.
- [ ] **Bytes encoding:** which columns are bytes and how to decode them.
- [ ] **Bot detection:** how humans are told apart from bots.
- [ ] **Timestamps:** unit, timezone, and per-match relative time for playback.
- [ ] **Event types:** exact values for kill, death, loot, storm death, and others.
- [ ] **Edge cases:** nulls, out-of-bounds points, duplicate events, matches crossing midnight.

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
