---
name: inspect-data
description: Explore the LILA BLACK telemetry parquet files safely with DuckDB, covering schema, counts, distinct values, sample rows and edge cases, without dumping large output into context. Use before writing pipeline code, when you are unsure about a column, or when filling in the "Data gotchas" section of CLAUDE.md.
---

# Inspect telemetry data

The raw data lives in `data/raw/player_data/` and is read-only. Never `cat` or `head` parquet files. Always query with a `LIMIT`.

Files are parquet with **no `.parquet` extension**. They are named `February_DD/{user_id}_{match_id}.nakama-0`. Read them with:
```sql
read_parquet('data/raw/player_data/February_*/*.nakama-0', filename=true)
```
`filename=true` exposes the path, which is the only source of the **date** (from the folder name).

## Running queries

Preferred, with no install needed:
```bash
uv run --with duckdb python -c "import duckdb; print(duckdb.sql(\"<SQL>\"))"
```
Fallback: `duckdb -c "<SQL>"` if the CLI is installed.

## Steps

1. **Read the provided README first:** `data/raw/player_data/README.md`. Verify its claims rather than trusting them; for example, it says minimaps are 1024px, but they are not.
2. **Inventory:** `ls data/raw/player_data` and `du -sh data/raw/player_data/*`.
3. **Schema:** `DESCRIBE SELECT * FROM read_parquet('data/raw/player_data/February_*/*.nakama-0')`
4. **Volume:** row counts by file, date, map and match.
5. **Categoricals:** `SELECT col, count(*) ... GROUP BY 1 ORDER BY 2 DESC LIMIT 30` for event type, map, and the player/bot flag.
6. **Bytes columns:** look at a few raw values and confirm the decoding (utf-8? fixed width? an ID?).
7. **Timestamps:** min and max per match, the unit (s/ms/µs), whether they are monotonic, and timezone hints.
8. **Coordinates:** min, max and percentiles of x/y/z per map. Compare them with the README's world bounds.
9. **Edge cases:** nulls per column, duplicate rows, events outside map bounds, matches that span two dates, matches with 0 humans.

## Output

- Put a summary of the findings in the **Data gotchas** section of `CLAUDE.md`, replacing the TODOs.
- Log every ambiguity and the assumption you chose in `docs/DECISIONS.md` under "Assumptions about the data".
- Keep each query's printed output small (<~40 rows).
