#!/usr/bin/env python3
"""Generate a standalone Electron project for a compatible Daba HTML export."""

import argparse
import base64
import binascii
import io
import json
import math
import re
import shutil
import tempfile
from html import escape
from html.parser import HTMLParser
from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError as error:
    raise SystemExit("This helper requires Pillow. Use a Python environment with Pillow installed.") from error


TEMPLATE = Path(__file__).resolve().parents[1] / "assets" / "desktop-template"
ELECTRON = "45.4.1"
BUILDER = "26.18.0"
REQUIRED_CLIPS = frozenset("""
    portrait blink lookUp sniff greet greetLie restTurn restTurnStart restTurnEnd
    foldChin realLift tiredPant proneYawn restLick yawnRestBefore yawnRestAfter
    sitNatural sitTilt sitLick sitNod stretch stretchHold hop drink food paw bark bone
    greetStand0 greetStand1 greetStand2 greetStand3 greetStand4
""".split())


class AtlasScript(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.sources = []
        self.collecting = False

    def handle_starttag(self, tag, attrs):
        fields = dict(attrs)
        if tag == "script" and fields.get("id") == "daba-frames":
            if fields.get("type") != "application/json":
                raise ValueError("The daba-frames script must have type application/json")
            self.sources.append([])
            self.collecting = True

    def handle_data(self, data):
        if self.collecting:
            self.sources[-1].append(data)

    def handle_endtag(self, tag):
        if tag == "script":
            self.collecting = False


def read_atlas(source):
    parser = AtlasScript()
    parser.feed(source.read_text(encoding="utf-8"))
    parser.close()
    if len(parser.sources) != 1 or parser.collecting:
        raise ValueError("Expected one complete script element with id daba-frames")
    value = json.loads("".join(parser.sources[0]))
    if not isinstance(value, dict):
        raise ValueError("The atlas must contain a JSON object")
    return value


def decode_data_uri(value, mime):
    prefix = f"data:{mime};base64,"
    if not isinstance(value, str) or not value.startswith(prefix):
        raise ValueError(f"Expected an embedded {mime} data URI")
    return base64.b64decode(value[len(prefix):], validate=True)


def real_number(value):
    return type(value) in (int, float) and math.isfinite(value)


def verify_atlas(atlas):
    sheets, clips, views = (atlas.get(key) for key in ("sheets", "clips", "views"))
    if not isinstance(sheets, list) or not sheets or not isinstance(clips, dict) or not isinstance(views, dict):
        raise ValueError("Atlas needs sheets, clips, and views")
    missing = REQUIRED_CLIPS - clips.keys()
    if missing:
        raise ValueError("Missing compatible clips: " + ", ".join(sorted(missing)))

    dimensions = []
    for source in sheets:
        with Image.open(io.BytesIO(decode_data_uri(source, "image/webp"))) as image:
            if image.format != "WEBP":
                raise ValueError("A sheet advertised as WebP contains different image data")
            dimensions.append(image.size)
            image.verify()

    def check_rect(rect, name):
        if not isinstance(rect, list) or len(rect) != 5 or any(type(n) is not int for n in rect):
            raise ValueError(f"Malformed atlas rectangle in {name}")
        sheet, x, y, width, height = rect
        if not 0 <= sheet < len(dimensions):
            raise ValueError(f"Invalid sheet index in {name}")
        sw, sh = dimensions[sheet]
        if x < 0 or y < 0 or width < 1 or height < 1 or x + width > sw or y + height > sh:
            raise ValueError(f"Frame outside sheet bounds in {name}")

    for name, clip in clips.items():
        if not isinstance(clip, dict):
            raise ValueError(f"Malformed clip {name}")
        frames, fps, box = (clip.get(key) for key in ("frames", "fps", "box"))
        if not isinstance(frames, list) or not frames or not real_number(fps) or fps <= 0:
            raise ValueError(f"Clip {name} needs frames and a positive frame rate")
        if not isinstance(box, list) or len(box) != 4 or not all(map(real_number, box)) or min(box[2:]) <= 0:
            raise ValueError(f"Clip {name} needs a valid drawing box")
        for rect in frames:
            check_rect(rect, name)
        tail = clip.get("tail")
        if tail is not None:
            if not isinstance(tail, dict):
                raise ValueError(f"Malformed tail in {name}")
            if "frame" in tail:
                check_rect(tail["frame"], name)
            for rect in tail.get("frames", []):
                check_rect(rect, name)

    for direction in ("stand", "walk", "run"):
        entries = views.get(direction)
        if not isinstance(entries, list) or len(entries) != 8:
            raise ValueError(f"{direction} needs eight directional views")
        for entry in entries:
            if not isinstance(entry, list) or len(entry) != 2 or entry[0] not in clips or type(entry[1]) is not bool:
                raise ValueError(f"Invalid {direction} view")

    if atlas.get("barkSound"):
        decode_data_uri(atlas["barkSound"], "audio/mpeg")
        if not real_number(atlas.get("barkLeadIn")) or atlas["barkLeadIn"] < 0:
            raise ValueError("An embedded bark needs a nonnegative barkLeadIn")


def write_icons(root, atlas):
    directory = root / "build"
    directory.mkdir()
    sheet, x, y, width, height = atlas["clips"]["portrait"]["frames"][0]
    with Image.open(io.BytesIO(decode_data_uri(atlas["sheets"][sheet], "image/webp"))) as page:
        portrait = page.crop((x, y, x + width, y + height)).convert("RGBA")
    bounds = portrait.getchannel("A").getbbox()
    if not bounds:
        raise ValueError("The portrait frame has no visible pixels")
    portrait = portrait.crop(bounds)
    portrait.thumbnail((365, 369), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (512, 512))
    ink = ImageDraw.Draw(canvas)
    ink.rounded_rectangle((18, 18, 494, 494), radius=109, fill="#132330", outline="#8bd2d7", width=6)
    ink.rounded_rectangle((37, 37, 475, 475), radius=92, outline="#31515a", width=3)
    canvas.alpha_composite(portrait, ((512 - portrait.width) // 2, (512 - portrait.height) // 2 + 25))
    canvas.save(directory / "icon.png")
    canvas.save(directory / "icon.ico", sizes=[(n, n) for n in (16, 32, 48, 64, 128, 256)])


def write_project(root, atlas, options):
    app = root / "app"
    shutil.copytree(TEMPLATE, app)
    html = app / "pet.html"
    document = html.read_text(encoding="utf-8")
    payload = json.dumps(atlas, ensure_ascii=False, separators=(",", ":")).replace("<", r"\u003c")
    document = document.replace("@@PET_TITLE@@", escape(options.app_name)).replace("@@PET_ATLAS@@", payload)
    html.write_text(document, encoding="utf-8")
    write_icons(root, atlas)

    metadata = {
        "name": options.app_id.replace(".", "-"),
        "productName": options.app_name,
        "version": options.version,
        "private": True,
        "description": "可离线运行的桌面宠物",
        "main": "app/main.cjs",
        "scripts": {
            "start": "electron .",
            "package:mac": "electron-builder --mac --x64 --arm64 --publish never",
            "package:win": "electron-builder --win --x64 --arm64 --publish never",
        },
        "devDependencies": {"electron": ELECTRON, "electron-builder": BUILDER},
        "build": {
            "appId": options.app_id,
            "productName": options.app_name,
            "artifactName": "${name}-${version}-${arch}.${ext}",
            "files": ["app/**", "package.json"],
            "asar": True,
            "publish": None,
            "mac": {
                "category": "public.app-category.entertainment",
                "target": "dmg",
                "icon": "build/icon.png",
                "identity": "-",
                "hardenedRuntime": False,
                "notarize": False,
                "extendInfo": {"LSUIElement": True},
            },
            "dmg": {"sign": False, "title": options.app_name},
            "win": {"target": "nsis", "icon": "build/icon.ico", "signAndEditExecutable": False},
            "nsis": {
                "artifactName": "${name}-${version}-Windows-Setup.${ext}",
                "oneClick": False,
                "perMachine": False,
                "allowToChangeInstallationDirectory": True,
                "installerIcon": "build/icon.ico",
                "uninstallerIcon": "build/icon.ico",
                "createDesktopShortcut": True,
                "createStartMenuShortcut": True,
                "shortcutName": options.app_name,
                "runAfterFinish": True,
                "installerLanguages": ["zh_CN", "en_US"],
            },
        },
    }
    (root / "package.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path, help="New project folder")
    parser.add_argument("--app-name", default="大巴桌面宠物")
    parser.add_argument("--app-id", required=True, help="Reverse DNS ID such as com.example.dabapet")
    parser.add_argument("--version", default="1.0.0")
    options = parser.parse_args()
    if not re.fullmatch(r"[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*){2,}", options.app_id):
        parser.error("--app-id must be a lower-case reverse DNS ID")
    if not re.fullmatch(r"(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)", options.version):
        parser.error("--version must have the form 1.2.3")
    if (
        not options.app_name.strip()
        or re.search(r'[<>:"/\\|?*\x00-\x1f]', options.app_name)
        or options.app_name.endswith((" ", "."))
    ):
        parser.error("--app-name must also be a valid filename for Windows")

    destination = options.destination.expanduser().absolute()
    if destination.exists() or destination.is_symlink():
        parser.error(f"destination already exists: {destination}")
    try:
        atlas = read_atlas(options.source.expanduser())
        verify_atlas(atlas)
        destination.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix=".desktop-pet-", dir=destination.parent) as stage:
            project = Path(stage) / "project"
            project.mkdir()
            write_project(project, atlas, options)
            if destination.exists() or destination.is_symlink():
                raise ValueError(f"destination already exists: {destination}")
            project.rename(destination)
    except (OSError, ValueError, TypeError, KeyError, binascii.Error) as error:
        parser.exit(1, f"Cannot generate the desktop pet project: {error}\n")
    print(f"Created {destination} with {len(atlas['clips'])} clips and {len(atlas['sheets'])} sheets")


if __name__ == "__main__":
    main()
