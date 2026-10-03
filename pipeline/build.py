"""Build the static dataset for the web viewer.

    uv run python build.py        (from pipeline/)

Reads every raw parquet file once with DuckDB, cleans it (see docs/DECISIONS.md, A1–A10), and writes:
  web/public/data/index.json      maps, dates, event codes
  web/public/data/<Map>.json      columnar rows + journeys + matches for one map
  web/public/maps/<Map>.webp      minimap resized for the web
"""

import json
from collections import defaultdict
from datetime import UTC, datetime

import duckdb
from PIL import Image

from config import (
    EVENT_CODES,
    MAP_IMG_OUT_DIR,
    MAPS,
    MOVEMENT_EVENTS,
    OUT_DIR,
    RAW_DIR,
    RAW_GLOB,
    WEB_IMAGE_MAX_PX,
)
from coords import uv_sql

UV_DECIMALS = 4  # 1e-4 UV ≈ 0.2px on a 2048px image


def load_clean(con: duckdb.DuckDBPyConnection) -> None:
    """Create the `clean` table: one row per distinct event, with a multiplicity `n`."""
    movement = ", ".join(f"'{e}'" for e in MOVEMENT_EVENTS)
    con.sql(f"""
        CREATE TABLE clean AS
        WITH raw AS (
            SELECT user_id, match_id, map_id, x, z,
                   -- A1: the stored 'ms' value is really Unix SECONDS (wall clock, UTC)
                   epoch_ms(ts) AS s,
                   decode(event) AS ev, filename,
                   -- The dataset's official date is the folder (Feb_10..14), not the UTC date of ts
                   regexp_extract(filename, 'February_(\\d+)', 1)::INT AS folder_day
            FROM read_parquet('{RAW_GLOB}', filename = true)
        ),
        per_file AS (
            SELECT user_id, match_id, map_id, ev, x, z, s, filename, folder_day, count(*) AS c
            FROM raw GROUP BY ALL
        ),
        -- A6: the same (user, match) can be split across day folders with overlapping rows.
        -- Take the max multiplicity across files so overlaps aren't double counted.
        merged AS (
            SELECT user_id, match_id, map_id, ev, x, z, s, max(c) AS n, min(folder_day) AS folder_day
            FROM per_file GROUP BY user_id, match_id, map_id, ev, x, z, s
        )
        SELECT user_id, match_id, map_id, ev, x, z, s, folder_day,
               -- A5: duplicate position samples are logging noise.
               -- A4/A10: duplicate loot/kill rows are real multiples (several in the same second).
               CASE WHEN ev IN ({movement}) THEN 1 ELSE n END AS n
        FROM merged
    """)

    unknown = con.sql(
        f"SELECT DISTINCT ev FROM clean WHERE ev NOT IN ({', '.join(f"'{e}'" for e in EVENT_CODES)})"
    )
    if unknown.fetchall():
        raise ValueError(f"Unknown event types: {unknown.fetchall()}")

    # A3: classify each journey by its event stream; fall back to the README's numeric-ID rule.
    con.sql(r"""
        CREATE TABLE journeys AS
        SELECT match_id, user_id,
               CASE WHEN bool_or(ev = 'BotPosition') THEN TRUE
                    WHEN bool_or(ev = 'Position') THEN FALSE
                    ELSE regexp_matches(user_id, '^\d+$') END AS is_bot
        FROM clean GROUP BY 1, 2
    """)
    con.sql("""
        CREATE TABLE matches AS
        SELECT match_id, any_value(map_id) AS map_id, min(s) AS start_s, max(s) - min(s) AS duration_s,
               min(folder_day) AS folder_day
        FROM clean GROUP BY 1
    """)


def build_map(con: duckdb.DuckDBPyConnection, map_id: str) -> dict:
    cfg = MAPS[map_id]
    u_expr, v_expr = uv_sql(cfg)
    rows = con.sql(f"""
        SELECT c.match_id, c.user_id, j.is_bot, m.start_s, m.duration_s, m.folder_day,
               (c.s - m.start_s)::INT AS t,
               round(({u_expr})::DOUBLE, {UV_DECIMALS}) AS u, round(({v_expr})::DOUBLE, {UV_DECIMALS}) AS v,
               c.ev, c.n
        FROM clean c
        JOIN journeys j USING (match_id, user_id)
        JOIN matches m USING (match_id)
        WHERE c.map_id = '{map_id}'
        ORDER BY m.start_s, c.match_id, j.is_bot, c.user_id, t, c.ev
    """).fetchall()

    matches: list[dict] = []
    match_index: dict[str, int] = {}
    journeys: list[dict] = []
    cols: dict[str, list] = {"t": [], "u": [], "v": [], "e": [], "n": []}
    out_of_bounds = 0

    for match_id, user_id, is_bot, start_s, duration_s, folder_day, t, u, v, ev, n in rows:
        if match_id not in match_index:
            match_index[match_id] = len(matches)
            start = datetime.fromtimestamp(start_s, UTC)
            matches.append(
                {
                    "id": match_id.removesuffix(".nakama-0"),
                    "date": f"{start.year}-02-{folder_day:02d}",  # folders are February_DD
                    "start": start.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "duration": int(duration_s),
                    "humans": 0,
                    "bots": 0,
                    "counts": [0] * len(EVENT_CODES),
                    "journeys": [],
                }
            )
        m_idx = match_index[match_id]
        match = matches[m_idx]

        if not journeys or journeys[-1]["user"] != user_id or journeys[-1]["match"] != m_idx:
            if journeys:
                journeys[-1]["end"] = len(cols["t"])
            journeys.append({"match": m_idx, "user": user_id, "bot": bool(is_bot), "start": len(cols["t"])})
            match["journeys"].append(len(journeys) - 1)
            match["bots" if is_bot else "humans"] += 1

        if not (0 <= u <= 1 and 0 <= v <= 1):
            out_of_bounds += 1
        code = EVENT_CODES[ev]
        match["counts"][code] += n
        cols["t"].append(t)
        cols["u"].append(u)
        cols["v"].append(v)
        cols["e"].append(code)
        cols["n"].append(n)

    if journeys:
        journeys[-1]["end"] = len(cols["t"])

    return {
        "map": map_id,
        "matches": matches,
        "journeys": journeys,
        "rows": cols,
        "_stats": {"rows": len(cols["t"]), "out_of_bounds": out_of_bounds},
    }


def export_minimap(map_id: str) -> tuple[str, int, int]:
    cfg = MAPS[map_id]
    Image.MAX_IMAGE_PIXELS = None  # Lockdown is 9000×9000; it's our own trusted asset
    with Image.open(RAW_DIR / "minimaps" / cfg.source_image) as img:
        img = img.convert("RGB")
        img.thumbnail((WEB_IMAGE_MAX_PX, WEB_IMAGE_MAX_PX), Image.Resampling.LANCZOS)
        name = f"{map_id}.webp"
        MAP_IMG_OUT_DIR.mkdir(parents=True, exist_ok=True)
        img.save(MAP_IMG_OUT_DIR / name, "WEBP", quality=82, method=6)
        return f"maps/{name}", img.width, img.height


def write_json(path, data) -> int:
    text = json.dumps(data, separators=(",", ":"))
    path.write_text(text)
    return len(text)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect()
    load_clean(con)

    index_maps = []
    all_dates: set[str] = set()
    for map_id, cfg in MAPS.items():
        data = build_map(con, map_id)
        stats = data.pop("_stats")
        if stats["out_of_bounds"]:
            print(f"  WARNING {map_id}: {stats['out_of_bounds']} rows outside the minimap")
        size = write_json(OUT_DIR / f"{map_id}.json", data)
        image, width, height = export_minimap(map_id)
        all_dates.update(m["date"] for m in data["matches"])
        index_maps.append(
            {
                "id": map_id,
                "label": cfg.label,
                "image": image,
                "width": width,
                "height": height,
                "data": f"data/{map_id}.json",
                "matchCount": len(data["matches"]),
                "journeyCount": len(data["journeys"]),
            }
        )
        print(
            f"{map_id:14} {len(data['matches']):4} matches {len(data['journeys']):5} journeys "
            f"{stats['rows']:6} rows  {size / 1e6:.2f} MB json  image {width}x{height}"
        )

    write_json(
        OUT_DIR / "index.json",
        {
            "generatedAt": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "maps": index_maps,
            "dates": sorted(all_dates),
            "eventCodes": EVENT_CODES,
        },
    )

    totals = defaultdict(int)
    for m in index_maps:
        totals["matches"] += m["matchCount"]
        totals["journeys"] += m["journeyCount"]
    print(f"TOTAL {totals['matches']} matches, {totals['journeys']} journeys, dates {sorted(all_dates)}")


if __name__ == "__main__":
    main()
