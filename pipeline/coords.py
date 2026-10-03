"""World → minimap coordinate mapping. The single source of truth on the pipeline side.

The README's formula multiplies by 1024, but the real minimap images are 4320², 2160×2158 and 9000².
So we emit normalized UV (0–1, origin top-left), and every consumer multiplies by its own image size.
"""

from config import MapConfig


def world_to_uv(cfg: MapConfig, x: float, z: float) -> tuple[float, float]:
    """Map world (x, z) to image-space UV: u grows right, v grows DOWN (image origin is top-left).

    `y` in the data is elevation and is ignored for the 2D minimap.
    """
    u = (x - cfg.origin_x) / cfg.scale
    v = 1.0 - (z - cfg.origin_z) / cfg.scale
    return u, v


def uv_sql(cfg: MapConfig) -> tuple[str, str]:
    """The same transform as SQL expressions over columns `x`, `z`, so DuckDB can do it in bulk."""
    # x/z are float32 in the source; widen first so rounding gives clean decimals
    u = f"((x::DOUBLE - ({cfg.origin_x})) / {cfg.scale})"
    v = f"(1.0 - (z::DOUBLE - ({cfg.origin_z})) / {cfg.scale})"
    return u, v
