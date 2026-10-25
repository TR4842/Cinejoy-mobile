#!/usr/bin/env python3
"""
Render the Android launcher icons and splash screens from app/assets/icon-source.png.

    python3 tools/make-android-assets.py

Writes into android/app/src/main/res:
  mipmap-*/ic_launcher.png, ic_launcher_round.png   (legacy launcher icons)
  mipmap-*/ic_launcher_foreground.png               (adaptive icon foreground)
  drawable/drawable-port-*/drawable-land-*/splash.png
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / "android" / "app" / "src" / "main" / "res"
ICON = ROOT / "assets" / "icon-source.png"
BG = (8, 8, 11)

DENSITIES = {"mdpi": 1.0, "hdpi": 1.5, "xhdpi": 2.0, "xxhdpi": 3.0, "xxxhdpi": 4.0}
LAUNCHER_DP = 48
FOREGROUND_DP = 108
SPLASH_PORT = (320, 480)
SPLASH_LAND = (480, 320)


def trim(img: Image.Image) -> Image.Image:
    # the generated art is a rounded tile with a glow margin; crop to the tile
    inset = int(img.size[0] * 0.185)
    return img.crop((inset, inset, img.size[0] - inset, img.size[1] - inset))


def rounded(src: Image.Image, size: int, radius_ratio: float = 0.235, bg: tuple[int, int, int] | None = None) -> Image.Image:
    art = src.resize((size, size), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (bg or (0, 0, 0)) + (255,))
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * radius_ratio), fill=255)
    canvas.paste(art, (0, 0), mask)
    return canvas


def circle(src: Image.Image, size: int) -> Image.Image:
    art = src.resize((size, size), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), BG + (255,))
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, size - 1, size - 1], fill=255)
    canvas.paste(art, (0, 0), mask)
    return canvas


def splash(landscape: bool, base: tuple[int, int], mark: Image.Image) -> Image.Image:
    """`base` is the target size in px (already scaled for the density)."""
    w, h = base
    img = Image.new("RGBA", (w, h), (5, 5, 8, 255))
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    r = int(min(w, h) * 0.75)
    gd.ellipse([w // 2 - r, h // 2 - r, w // 2 + r, h // 2 + r], fill=(255, 46, 99, 40))
    glow = glow.filter(ImageFilter.GaussianBlur(int(min(w, h) * 0.16)))
    img = Image.alpha_composite(img, glow)
    size = int(min(w, h) * (0.34 if landscape else 0.30))
    # feather the tile edges so it melts into the glow instead of showing a box
    art = mark.resize((size, size), Image.LANCZOS)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, size - 1, size - 1], radius=int(size * 0.24), fill=255
    )
    mask = mask.filter(ImageFilter.GaussianBlur(max(2, int(size * 0.05))))
    img.paste(art, (w // 2 - size // 2, h // 2 - size // 2 - int(size * 0.18)), mask)
    return img.convert("RGB")


def main() -> int:
    src = trim(Image.open(ICON).convert("RGBA"))

    for density, scale in DENSITIES.items():
        out = RES / f"mipmap-{density}"
        out.mkdir(parents=True, exist_ok=True)
        size = int(LAUNCHER_DP * scale)
        rounded(src, size).save(out / "ic_launcher.png")
        circle(src, size).save(out / "ic_launcher_round.png")

        # Adaptive icon foreground: art inside the 72dp safe zone of a 108dp canvas.
        fg_size = int(FOREGROUND_DP * scale)
        inner = int(fg_size * 0.66)
        fg = Image.new("RGBA", (fg_size, fg_size), (0, 0, 0, 0))
        fg.alpha_composite(rounded(src, inner, 0.26, BG), ((fg_size - inner) // 2, (fg_size - inner) // 2))
        fg.save(out / "ic_launcher_foreground.png")

    for landscape in (False, True):
        for density, scale in DENSITIES.items():
            w, h = (SPLASH_LAND if landscape else SPLASH_PORT)
            out = RES / f"drawable-{'land' if landscape else 'port'}-{density}"
            out.mkdir(parents=True, exist_ok=True)
            img = splash(landscape, (int(w * scale), int(h * scale)), src)
            img.save(out / "splash.png")

    # generic drawable fallback
    (RES / "drawable").mkdir(parents=True, exist_ok=True)
    splash(False, SPLASH_PORT, src).save(RES / "drawable" / "splash.png")

    # Play Store / README artwork
    docs = ROOT.parent / "docs"
    docs.mkdir(exist_ok=True)
    rounded(src, 512).save(docs / "icon-512.png")
    splash(False, (540, 960), src).save(docs / "splash-portrait.png")
    print("android assets written to", RES)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
