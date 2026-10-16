#!/usr/bin/env python3
"""Extract FloorLayout details from every dungeon floor XML into data.js.

Reads dungeon_export/index.csv (natural dungeon order) and every
dungeon_export/<folder>/floor_*.xml, then writes `data.js` next to this script:
a self-contained JS file (`const FLOOR_DATA = {...}`) that the web page loads
via a plain <script> tag, so the page works from file:// without a server.

Re-run after changing the export:  .venv/bin/python build_data.py
"""

import csv
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent
EXPORT = ROOT / "dungeon_export"
OUT = ROOT / "data.js"

# Field order for every row. (name, kind) where kind is "int", "str" or "ref".
# "ref" = index into the dungeons list (resolved at load time in the page).
FIELDS = [
    # identity
    ("dungeon_idx", "ref"),
    ("floor", "int"),          # floor number from the file name (floor_00N.xml)
    # FloorLayout
    ("number", "int"),
    ("structure", "str"),
    ("tileset", "int"),
    ("bgm", "int"),
    ("weather", "str"),
    ("fixed_floor_id", "int"),
    ("darkness_level", "str"),
    # GeneratorSettings
    ("room_density", "int"),
    ("floor_connectivity", "int"),
    ("initial_enemy_density", "int"),
    ("dead_ends", "int"),
    ("item_density", "int"),
    ("trap_density", "int"),
    ("extra_hallway_density", "int"),
    ("buried_item_density", "int"),
    ("water_density", "int"),
    ("max_coin_amount", "int"),
    # Chances
    ("shop", "int"),
    ("monster_house", "int"),
    ("unused", "int"),
    ("sticky_item", "int"),
    ("empty_monster_house", "int"),
    ("hidden_stairs", "int"),
    # TerrainSettings
    ("secondary_used", "int"),
    ("secondary_percentage", "int"),
    ("imperfect_rooms", "int"),
    ("unk1", "int"),
    ("unk3", "int"),
    ("unk4", "int"),
    ("unk5", "int"),
    ("unk6", "int"),
    ("unk7", "int"),
    # MiscSettings
    ("unkE", "int"),
    ("kecleon_shop_item_positions", "int"),
    ("unk_hidden_stairs", "int"),
    ("enemy_iq", "int"),
    ("iq_booster_boost", "int"),
]

INT_FIELDS = {name for name, kind in FIELDS if kind == "int"}
STR_FIELDS = {name for name, kind in FIELDS if kind == "str"}

FLOOR_FILE_RE = re.compile(r"floor_(\d+)\.xml$")


def parse_floor(path: Path) -> dict:
    fl = ET.parse(path).getroot().find("FloorLayout")
    if fl is None:
        raise RuntimeError(f"no FloorLayout in {path}")
    out: dict = {}
    for section in ("FloorLayout", "GeneratorSettings", "Chances",
                    "TerrainSettings", "MiscSettings"):
        el = fl if section == "FloorLayout" else fl.find(section)
        if el is None:
            raise RuntimeError(f"missing <{section}> in {path}")
        out.update(el.attrib)
    return out


def main() -> int:
    with (EXPORT / "index.csv").open(newline="", encoding="utf-8") as fh:
        dungeons = list(csv.DictReader(fh))

    rows = []
    mismatches = []
    for di, d in enumerate(dungeons):
        folder = EXPORT / d["folder"]
        if not folder.is_dir():
            raise RuntimeError(f"missing folder for dungeon {d['dungeon_id']}: {folder}")
        files = sorted(folder.glob("floor_*.xml"),
                       key=lambda p: int(FLOOR_FILE_RE.search(p.name).group(1)))
        if len(files) != int(d["number_floors"]):
            print(f"warning: {d['folder']} has {len(files)} floor files, "
                  f"index.csv says {d['number_floors']}", file=sys.stderr)
        for fpath in files:
            attrs = parse_floor(fpath)
            fnum = int(FLOOR_FILE_RE.search(fpath.name).group(1))
            if str(fnum) != attrs.get("number"):
                mismatches.append((fpath.name, attrs.get("number")))
            row = []
            for name, kind in FIELDS:
                if kind == "ref":
                    row.append(di)
                    continue
                if name == "floor":  # derived from the file name, not the XML
                    row.append(fnum)
                    continue
                raw = attrs.get(name)
                if raw is None:
                    raise RuntimeError(f"missing attribute {name!r} in {fpath}")
                if kind == "int":
                    row.append(int(raw))
                else:
                    row.append(raw)
            rows.append(row)

    payload = {
        "fields": [name for name, _ in FIELDS],
        "fieldKinds": {name: kind for name, kind in FIELDS},
        "dungeons": [[int(d["dungeon_id"]), d["folder"], d["dungeon_name"],
                      int(d["number_floors"]),
                      int(d["mappa_index"]) if d["mappa_index"] else None,
                      int(d["start_after"]) if d["start_after"] else None]
                     for d in dungeons],
        "rows": rows,
    }

    OUT.write_text("const FLOOR_DATA = " + json.dumps(payload, separators=(",", ":")) + ";\n",
                   encoding="utf-8")
    print(f"wrote {OUT.name}: {len(dungeons)} dungeons, {len(rows)} floors, "
          f"{len(FIELDS)} fields, {OUT.stat().st_size // 1024} KiB")
    if mismatches:
        print(f"note: {len(mismatches)} floors where file number != number "
              f"attribute (e.g. {mismatches[:3]})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
