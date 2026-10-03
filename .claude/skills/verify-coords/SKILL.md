---
name: verify-coords
description: Visually verify that the world→minimap coordinate mapping is correct by rendering telemetry points over each minimap image and inspecting the result. Use after writing or changing any coordinate transform, and before saying the mapping works.
---

# Verify coordinate mapping

LILA calls coordinate mapping "the tricky part" and grades it explicitly. Do not trust the math. Look at the result.

## Steps

1. Use the **same transform** as the pipeline: import it from `pipeline/`, don't reimplement it.
2. Create or update `pipeline/debug/verify_coords.py`. For each map it should:
   - load the minimap image
   - plot a sample of position events (~20k) as small semi-transparent dots
   - plot kills and deaths in a contrasting color
   - draw the image border and print the % of points that fall outside `[0, width] × [0, height]`
   - save to `pipeline/debug/out/<map>.png`
3. Run it: `uv run --with pillow --with matplotlib --with duckdb python pipeline/debug/verify_coords.py`
4. **Read each output PNG** with the Read tool and check:
   - Paths follow roads, corridors and buildings. They should not cross water or void, or sit outside the playable area.
   - No mirroring. A wrong Y-flip shows paths reflected top to bottom. Swapped axes show the map rotated 90°.
   - Point density lines up with obvious points of interest.
   - Out-of-bounds % is about 0. If not, explain why (spawn areas? bad data?) in `docs/DECISIONS.md`.
5. When the web app exists, check the same thing in the browser (`/run` or Chrome) for one match, so the frontend transform matches too.

## Report

State which maps passed and give the out-of-bounds % for each. Record the final transform (formula and constants per map) in `docs/DECISIONS.md`. It goes into ARCHITECTURE.md.
