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

## Assumptions about the data

_(fill in as we discover ambiguities)_
