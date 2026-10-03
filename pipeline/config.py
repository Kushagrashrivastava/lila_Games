"""Static configuration: paths, map coordinate systems, event codes."""

from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw" / "player_data"
RAW_GLOB = str(RAW_DIR / "February_*" / "*.nakama-0")
OUT_DIR = ROOT / "web" / "public" / "data"
MAP_IMG_OUT_DIR = ROOT / "web" / "public" / "maps"

# Longest side of the minimap images we ship to the browser. Sources are 2160–9000px and 3–12MB.
WEB_IMAGE_MAX_PX = 2048


@dataclass(frozen=True)
class MapConfig:
    id: str
    label: str
    source_image: str
    scale: float
    origin_x: float
    origin_z: float


# From data/raw/player_data/README.md ("Map Configuration").
MAPS: dict[str, MapConfig] = {
    m.id: m
    for m in [
        MapConfig("AmbroseValley", "Ambrose Valley", "AmbroseValley_Minimap.png", 900, -370, -473),
        MapConfig("GrandRift", "Grand Rift", "GrandRift_Minimap.png", 581, -290, -290),
        MapConfig("Lockdown", "Lockdown", "Lockdown_Minimap.jpg", 1000, -500, -500),
    ]
}

# Compact integer codes used in the output files. Must match web/src/data/events.ts.
EVENT_CODES: dict[str, int] = {
    "Position": 0,
    "BotPosition": 1,
    "Loot": 2,
    "BotKill": 3,
    "BotKilled": 4,
    "KilledByStorm": 5,
    "Kill": 6,
    "Killed": 7,
}
MOVEMENT_EVENTS = ("Position", "BotPosition")
