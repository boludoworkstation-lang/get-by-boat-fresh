"""Create opaque Get By Boat icons for Flutter's generated iOS AppIcon set.

Uses only Python's standard library and macOS's built-in sips command.
Run after: flutter create --platforms=ios --org net.getbyboat .
"""
from __future__ import annotations

import json
import math
import struct
import subprocess
import tempfile
import zlib
from pathlib import Path


def chunk(kind: bytes, payload: bytes) -> bytes:
    return (
        struct.pack(">I", len(payload))
        + kind
        + payload
        + struct.pack(">I", zlib.crc32(kind + payload) & 0xFFFFFFFF)
    )


def make_master(path: Path, side: int = 1024) -> None:
    rows = bytearray()
    for y in range(side):
        rows.append(0)
        t = y / (side - 1)
        background = (
            round(7 * (1 - t) + 0 * t),
            round(63 * (1 - t) + 153 * t),
            round(94 * (1 - t) + 173 * t),
        )
        for x in range(side):
            # Two open white waves based on the brand's existing favicon.
            alpha = 0.0
            if 135 <= x <= 889:
                arc = math.sin((x - 175) * math.pi / 300)
                for base in (424, 589):
                    distance = abs(y - (base - 57 * arc))
                    alpha = max(alpha, min(1.0, max(0.0, (27 - distance) / 3)))
            rgb = tuple(round(v * (1 - alpha) + 255 * alpha) for v in background)
            rows.extend(rgb)
    header = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", side, side, 8, 2, 0, 0, 0)
    path.write_bytes(header + chunk(b"IHDR", ihdr)
                     + chunk(b"IDAT", zlib.compress(rows, 9))
                     + chunk(b"IEND", b""))


def main() -> None:
    folder = Path(__file__).resolve().parents[1] / "ios" / "Runner" / "Assets.xcassets" / "AppIcon.appiconset"
    manifest_path = folder / "Contents.json"
    if not manifest_path.exists():
        raise SystemExit("Generate the Flutter iOS runner first with flutter create --platforms=ios .")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    with tempfile.TemporaryDirectory() as temp:
        master = Path(temp) / "get-by-boat-1024.png"
        make_master(master)
        for image in manifest["images"]:
            filename = image.get("filename")
            if not filename:
                continue
            size = float(image["size"].split("x")[0])
            scale = float(image["scale"].replace("x", ""))
            pixels = round(size * scale)
            output = folder / filename
            if pixels == 1024:
                output.write_bytes(master.read_bytes())
            else:
                subprocess.run(
                    ["sips", "-z", str(pixels), str(pixels), str(master),
                     "--out", str(output)],
                    check=True,
                    capture_output=True,
                )
    print("Generated Get By Boat iOS AppIcon artwork.")


if __name__ == "__main__":
    main()
