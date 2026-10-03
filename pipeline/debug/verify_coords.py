"""Draw every built position/event over its web minimap to eyeball the coordinate mapping.

    uv run python debug/verify_coords.py      (from pipeline/, after build.py)

Reads the *built* JSON (not the raw data), so it checks exactly what the browser will render.
Output: pipeline/debug/out/<Map>.png (gitignored).
"""

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from config import EVENT_CODES, OUT_DIR, ROOT  # noqa: E402

DEBUG_OUT = Path(__file__).parent / "out"
PREVIEW_PX = 1400
HUMAN, BOT, KILL, DEATH, STORM = (
    (40, 200, 255),
    (255, 150, 30),
    (255, 40, 40),
    (255, 255, 255),
    (200, 80, 255),
)
DEATHS = {EVENT_CODES["Killed"], EVENT_CODES["BotKilled"]}
KILLS = {EVENT_CODES["Kill"], EVENT_CODES["BotKill"]}
MOVES = {EVENT_CODES["Position"], EVENT_CODES["BotPosition"]}


def main() -> None:
    DEBUG_OUT.mkdir(exist_ok=True)
    index = json.loads((OUT_DIR / "index.json").read_text())
    for m in index["maps"]:
        data = json.loads((OUT_DIR / f"{m['id']}.json").read_text())
        img = Image.open(ROOT / "web" / "public" / m["image"]).convert("RGB")
        img = img.resize((PREVIEW_PX, round(PREVIEW_PX * img.height / img.width)))
        img = Image.blend(img, Image.new("RGB", img.size), 0.35)  # darken so dots stand out
        draw = ImageDraw.Draw(img)
        w, h = img.size
        rows = data["rows"]

        for j in data["journeys"]:
            color = BOT if j["bot"] else HUMAN
            pts = [
                (rows["u"][i] * w, rows["v"][i] * h)
                for i in range(j["start"], j["end"])
                if rows["e"][i] in MOVES
            ]
            if len(pts) > 1:
                draw.line(pts, fill=color, width=1)

        for i, e in enumerate(rows["e"]):
            x, y = rows["u"][i] * w, rows["v"][i] * h
            if e in KILLS:
                draw.ellipse((x - 3, y - 3, x + 3, y + 3), outline=KILL, width=2)
            elif e in DEATHS:
                draw.line((x - 3, y - 3, x + 3, y + 3), fill=DEATH, width=2)
                draw.line((x - 3, y + 3, x + 3, y - 3), fill=DEATH, width=2)
            elif e == EVENT_CODES["KilledByStorm"]:
                draw.rectangle((x - 5, y - 5, x + 5, y + 5), outline=STORM, width=3)

        out = DEBUG_OUT / f"{m['id']}.png"
        img.save(out)
        print(f"{m['id']}: wrote {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
