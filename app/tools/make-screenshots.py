#!/usr/bin/env python3
"""
Marketing screenshots for the README, rendered straight from the app's own
stylesheet and bundled catalog (no browser required — the sandbox has no
Chromium, and this keeps the docs reproducible).

    python3 tools/make-screenshots.py   →   docs/screens/*.png
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT.parent / "docs" / "screens"
STILL = ROOT / "assets" / "sample-still.png"
ICON = ROOT / "assets" / "icon-source.png"
FONT_B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_R = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

W, H = 720, 1560
BG = (8, 8, 11)
SURFACE = (20, 20, 29)
TEXT = (245, 245, 247)
MUTED = (154, 154, 171)
MUTED2 = (111, 111, 128)
ACCENT = (255, 46, 99)
ACCENT2 = (255, 138, 61)


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_B if bold else FONT_R, size)


class Screen:
    def __init__(self) -> None:
        self.img = Image.new("RGB", (W, H), BG)
        self.d = ImageDraw.Draw(self.img)

    def text(self, xy, s, size=22, color=TEXT, bold=False, anchor="la"):
        self.d.text(xy, s, font=font(size, bold), fill=color, anchor=anchor)

    def grad(self, box, c1, c2):
        x0, y0, x1, y1 = box
        w = max(1, x1 - x0)
        tile = Image.new("RGB", (w, 1))
        for x in range(w):
            t = x / w
            tile.putpixel((x, 0), tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3)))
        self.img.paste(tile.resize((w, max(1, y1 - y0))), (x0, y0))

    def round_rect(self, box, r, fill, outline=None):
        self.d.rounded_rectangle(box, radius=r, fill=fill, outline=outline)

    def button(self, box, label, primary=True, size=22):
        if primary:
            self.grad(box, ACCENT, (255, 122, 61))
        else:
            self.round_rect(box, (box[3] - box[1]) // 2, (38, 38, 50), (60, 60, 76))
        cx, cy = (box[0] + box[2]) // 2, (box[1] + box[3]) // 2
        self.text((cx, cy), label, size, TEXT if primary else TEXT, True, "mm")

    def poster(self, x, y, w, h, tint=(40, 40, 58), title=""):
        art = Image.new("RGB", (w, h), tint)
        ad = ImageDraw.Draw(art)
        for i in range(h):
            t = i / h
            ad.line([(0, i), (w, i)], fill=(int(tint[0] * (0.55 + t * 0.8)), int(tint[1] * (0.55 + t * 0.8)), int(tint[2] * (0.6 + t * 0.9))))
        ad.ellipse([w * 0.15, h * 0.1, w * 0.95, h * 0.72], fill=(int(tint[0] * 1.5) % 255, int(tint[1] * 1.3) % 255, int(tint[2] * 1.2) % 255))
        art = art.filter(ImageFilter.GaussianBlur(9))
        mask = Image.new("L", (w, h), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, h - 1], radius=16, fill=255)
        self.img.paste(art, (x, y), mask)
        if title:
            self.text((x + w // 2, y + h // 2), title[:1], 30, (255, 255, 255, 90), True, "mm")

    def tabbar(self, active=0):
        y0 = H - 112
        self.d.rectangle([0, y0, W, H], fill=(10, 10, 15))
        self.d.line([(0, y0), (W, y0)], fill=(34, 34, 44), width=2)
        labels = ["Home", "Search", "Downloads", "My list", "Settings"]
        for i, label in enumerate(labels):
            cx = int(W / 5 * (i + 0.5))
            color = TEXT if i == active else MUTED2
            self.d.ellipse([cx - 11, y0 + 24, cx + 11, y0 + 46], outline=color, width=3)
            self.text((cx, y0 + 64), label, 15, color, i == active, "mm")
            if i == active:
                self.grad([cx - 20, y0, cx + 20, y0 + 4], ACCENT, ACCENT2)

    def save(self, name):
        OUT.mkdir(parents=True, exist_ok=True)
        self.img.save(OUT / name, optimize=True)
        print("wrote", OUT / name)


def backdrop(w, h, blur=0, darken=0.0):
    src = Image.open(STILL).convert("RGB")
    scale = max(w / src.width, h / src.height)
    src = src.resize((int(src.width * scale) + 1, int(src.height * scale) + 1), Image.LANCZOS)
    left = (src.width - w) // 2
    top = (src.height - h) // 3
    crop = src.crop((left, top, left + w, top + h))
    if blur:
        crop = crop.filter(ImageFilter.GaussianBlur(blur))
    if darken:
        crop = Image.eval(crop, lambda v: int(v * (1 - darken)))
    return crop


# --------------------------------------------------------------------- screens

def home():
    s = Screen()
    hero = backdrop(W, 980, darken=0.15)
    s.img.paste(hero, (0, 0))
    # bottom fade like .hero-fade
    fade = Image.new("L", (1, 980))
    for y in range(980):
        t = y / 980
        fade.putpixel((0, y), int(255 * min(1, max(0, (t - 0.25) / 0.75) ** 1.25)))
    fade = fade.resize((W, 980))
    s.img.paste(Image.new("RGB", (W, 980), BG), (0, 0), fade)

    s.text((36, 40), "CINEJOY", 26, TEXT, True)
    s.text((196, 40), "", 26)
    s.d.ellipse([W - 76, 34, W - 40, 70], outline=MUTED, width=3)

    s.text((36, 610), "★ 7.5  ·  2026", 20, (255, 212, 121), True)
    s.text((36, 646), "The Cycle", 58, TEXT, True)
    s.text((36, 722), "TC · 1h 51m · Crime · Horror", 20, (201, 201, 212))
    s.text((36, 762), "A daughter unravels her father's dark past after", 19, (185, 185, 198))
    s.text((36, 788), "his body, missing for 36 years, is found at a", 19, (185, 185, 198))
    s.text((36, 814), "horrific crime scene.", 19, (185, 185, 198))
    s.button([36, 856, 236, 916], "▶  Play")
    s.button([252, 856, 432, 916], "My list", primary=False)
    s.round_rect([448, 856, 556, 916], 30, (26, 26, 36), (60, 60, 76))
    s.text((502, 886), "Details", 17, TEXT, True, "mm")

    s.text((36, 966), "Continue watching", 26, TEXT, True)
    cw = backdrop(300, 168, darken=0.1)
    mask = Image.new("L", (300, 168), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, 299, 167], radius=16, fill=255)
    s.img.paste(cw, (36, 1008), mask)
    s.d.ellipse([166, 1066, 226, 1126], fill=(10, 10, 14), outline=(220, 220, 230), width=3)
    s.text((196, 1096), "▶", 22, TEXT, True, "mm")
    s.grad([38, 1164, 190, 1169], ACCENT, ACCENT2)
    s.d.rounded_rectangle([36, 1008, 336, 1176], radius=16, outline=(60, 60, 76), width=2)

    s.text((36, 1194), "Trending movies", 26, TEXT, True)
    s.text((W - 36, 1200), "See all", 18, MUTED, False, "ra")
    tints = [(44, 46, 78), (70, 40, 52), (36, 56, 62), (58, 46, 34), (40, 44, 60)]
    x = 36
    for i, tint in enumerate(tints):
        s.poster(x, 1234, 116, 156, tint)
        s.round_rect([x + 6, 1234 + 130, x + 46, 1234 + 150], 8, (10, 10, 14))
        s.text((x + 8, 1398), ["The Cycle", "Clayface", "Hope", "Obsidian", "Lupin"][i][:9], 15, TEXT, False)
        x += 128
    s.tabbar(0)
    s.save("home.png")


def player():
    s = Screen()
    video = backdrop(W, 740, darken=0.05)
    # centre the "CINEJOY sample" card like the bundled reel
    vd = ImageDraw.Draw(video)
    vd.rectangle([0, 0, W, 740], fill=(0, 0, 0))
    video = Image.blend(video, backdrop(W, 740), 1.0)
    s.img.paste(video, (0, 0))
    s.text((W // 2, 330), "CINEJOY", 56, (255, 255, 255), True, "mm")
    s.text((W // 2, 392), "SAMPLE REEL", 22, (255, 255, 255), False, "mm")
    s.text((W - 16, 30), "12s", 20, (230, 230, 236), False, "ra")
    s.text((24, 690), "cinejoy.pk  ·  sample", 16, (235, 235, 240))

    s.d.rectangle([0, 0, W, 96], fill=(0, 0, 0))
    for y in range(96):
        row = Image.new("RGB", (W, 1), (0, 0, 0))
        s.img.paste(row, (0, y))
    s.round_rect([20, 30, 68, 78], 14, (16, 16, 22), (50, 50, 66))
    s.text((44, 54), "‹", 30, TEXT, True, "mm")
    s.text((84, 44), "The Cycle", 20, TEXT, True)
    s.text((84, 68), "2026 · Crime · Horror", 16, (200, 200, 212))
    s.round_rect([W - 68, 30, W - 20, 78], 14, (16, 16, 22), (50, 50, 66))
    s.text((W - 44, 54), "⤓", 24, TEXT, True, "mm")

    s.d.rectangle([0, 600, W, 740], fill=(0, 0, 0))
    s.round_rect([20, 616, 78, 640], 5, (44, 44, 56))
    s.text((48, 628), "TC", 13, (230, 230, 236), True, "mm")
    s.round_rect([86, 616, 156, 640], 5, (44, 44, 56))
    s.text((120, 628), "720p", 13, (230, 230, 236), True, "mm")
    # scrub bar
    s.d.rounded_rectangle([20, 668, W - 20, 674], radius=3, fill=(70, 70, 84))
    s.grad([20, 668, 340, 674], ACCENT, ACCENT2)
    s.d.ellipse([330, 660, 350, 680], fill=(255, 255, 255))
    s.text((24, 700), "0:12 / 1:00", 18, (240, 240, 246))
    s.text((W - 24, 700), "⛶", 24, TEXT, True, "ra")
    s.text((W - 190, 700), "⏭", 24, TEXT, True, "ra")
    s.text((W - 140, 700), "HD", 16, (220, 220, 230), True, "ra")

    s.text((28, 782), "The Cycle", 34, TEXT, True)
    s.text((28, 830), "2026 · TC · 1h 51m · Crime, Horror, Thriller", 18, MUTED)
    s.text((28, 880), "A daughter unravels her father's dark past after his body,", 19, MUTED)
    s.text((28, 908), "missing for 36 years, is found at a horrific crime scene.", 19, MUTED)

    s.round_rect([28, 960, W - 28, 1136], 20, SURFACE, (44, 44, 58))
    labels = [("Rating", "★ 7.5 · 10"), ("Genres", "Crime, Horror"), ("Director", "Jordan Downey"), ("Language", "EN")]
    for i, (label, value) in enumerate(labels):
        x = 56 + (i % 2) * 320
        y = 992 + (i // 2) * 68
        s.text((x, y), label.upper(), 13, MUTED2, True)
        s.text((x, y + 22), value, 19, TEXT, True)

    s.text((28, 1176), "Downloads", 26, TEXT, True)
    for i, (label, meta, done) in enumerate(
        [("1080p", "3.1 MB · offline ready", 1.0), ("720p", "2.4 MB · downloading 68%", 0.68)]
    ):
        y = 1224 + i * 104
        s.round_rect([28, y, W - 28, y + 88], 16, SURFACE, (44, 44, 58))
        s.text((52, y + 20), label, 21, TEXT, True)
        s.text((52, y + 50), meta, 16, MUTED2)
        if done < 1:
            s.d.rounded_rectangle([W - 220, y + 48, W - 52, y + 56], radius=4, fill=(50, 50, 64))
            s.grad([W - 220, y + 48, W - 220 + int(168 * done), y + 56], ACCENT, ACCENT2)
        else:
            s.text((W - 56, y + 44), "✓ Saved", 17, (53, 211, 154), True, "ra")
    s.tabbar(2)
    s.save("player.png")


def downloads():
    s = Screen()
    s.text((36, 64), "Downloads", 42, TEXT, True)
    s.text((36, 118), "3 saved · 7.9 MB", 18, MUTED)

    s.text((36, 176), "IN PROGRESS", 14, MUTED2, True)
    s.round_rect([36, 208, W - 36, 400], 20, SURFACE, (44, 44, 58))
    s.poster(56, 228, 92, 138, (60, 40, 56))
    s.text((168, 232), "Lupin", 23, TEXT, True)
    s.text((168, 264), "S1 E2 · Chapter 2", 17, MUTED)
    s.text((168, 296), "720p · 2.4 MB · 68%", 16, MUTED2)
    s.d.rounded_rectangle([168, 328, W - 76, 338], radius=5, fill=(50, 50, 64))
    s.grad([168, 328, 168 + int((W - 244) * 0.68), 338], ACCENT, ACCENT2)
    s.round_rect([168, 352, 268, 388], 10, (44, 44, 58), (64, 64, 80))
    s.text((218, 370), "❙❙ Pause", 16, TEXT, True, "mm")

    s.text((36, 436), "READY OFFLINE", 14, MUTED2, True)
    items = [("The Cycle", "1080p · 3.1 MB", (60, 46, 42)), ("Spider-Man: Brand New Day", "720p · 2.4 MB", (44, 46, 78)), ("Lupin", "S1 E1 · 720p", (40, 52, 60))]
    for i, (name, meta, tint) in enumerate(items):
        y = 468 + i * 148
        s.round_rect([36, y, W - 36, y + 132], 20, SURFACE, (44, 44, 58))
        s.poster(54, y + 16, 76, 100, tint)
        s.text((150, y + 26), name[:26], 21, TEXT, True)
        s.text((150, y + 58), f"✓ {meta} · offline ready", 16, (110, 210, 170))
        s.round_rect([150, y + 86, 236, y + 118], 8, (255, 46, 99))
        s.text((193, y + 102), "▶ Play", 15, TEXT, True, "mm")
        s.round_rect([246, y + 86, 372, y + 118], 8, (40, 40, 52), (66, 66, 84))
        s.text((309, y + 102), "Save to device", 13, TEXT, True, "mm")
        s.text((W - 60, y + 102), "🗑", 20, (255, 99, 115), False, "mm")

    s.text((36, 936), "STORAGE", 14, MUTED2, True)
    s.d.rounded_rectangle([36, 964, W - 36, 976], radius=6, fill=(44, 44, 58))
    s.grad([36, 964, 300, 976], ACCENT, ACCENT2)
    s.text((36, 992), "7.9 MB used of 1.2 GB available to the app", 16, MUTED2)

    s.round_rect([36, 1044, W - 36, 1148], 16, (18, 26, 34), (40, 56, 72))
    s.text((58, 1068), "Downloads stay inside the app. Use", 16, (200, 214, 226))
    s.text((58, 1094), "“Save to device” to copy into Movies/Cinejoy.", 16, (200, 214, 226))
    s.tabbar(2)
    s.save("downloads.png")


def main() -> int:
    home()
    player()
    downloads()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
