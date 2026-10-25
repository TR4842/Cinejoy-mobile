#!/usr/bin/env python3
"""
Generate the bundled sample media for the Cinejoy app.

Everything here is produced locally so the repository never depends on a
third-party CDN for playback or downloads:

  public/media/sample-720.mp4   1280x720  60s   (~2-4 MB)
  public/media/sample-480.mp4    854x480  45s
  public/media/sample-540.mp4    960x540  30s
  public/media/sample-hls/*      HLS ladder (360p/540p/720p) + master.m3u8
  public/media/poster.jpg        poster image
  public/icons/*                 launcher / PWA icons
  public/icons/splash.webm|mp4   animated splash used by the loading screen

Requires: ffmpeg (static build is fine), Pillow.  Run with:
    python3 tools/make-sample-media.py
"""
from __future__ import annotations

import json
import math
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
PUBLIC = ROOT / "public"
MEDIA = PUBLIC / "media"
ICONS = PUBLIC / "icons"

STILL = ASSETS / "sample-still.png"
ICON = ASSETS / "icon-source.png"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

try:
    import imageio_ffmpeg

    FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
except Exception:  # pragma: no cover
    FFMPEG = shutil.which("ffmpeg") or "ffmpeg"

from PIL import Image, ImageDraw, ImageFilter, ImageFont  # noqa: E402


def run(args: list[str]) -> None:
    print("  $", " ".join(args[:12]), "…" if len(args) > 12 else "")
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def ensure_dirs() -> None:
    for d in (MEDIA, ICONS, MEDIA / "sample-hls"):
        d.mkdir(parents=True, exist_ok=True)


def _text_layer(w: int, h: int, lines: list[tuple[str, int, float, tuple[int, int, int, int]]]) -> Path:
    """Transparent PNG with centred text lines (y given as a fraction of height)."""
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for text, size, yfrac, color in lines:
        size = max(9, int(size))
        try:
            font = ImageFont.truetype(FONT, size)
        except OSError:
            font = ImageFont.load_default()
        d.text((w // 2, int(h * yfrac)), text, font=font, fill=color, anchor="mm")
    path = ROOT / "tools" / f".overlay-{w}x{h}-{abs(hash(tuple(l[0] for l in lines))) % 99999}.png"
    img.save(path)
    return path


def _watermark(text: str, size: int) -> Path:
    try:
        font = ImageFont.truetype(FONT, size)
    except OSError:
        font = ImageFont.load_default()
    bbox = font.getbbox(text)
    img = Image.new("RGBA", (bbox[2] - bbox[0] + 8, bbox[3] - bbox[1] + 10), (0, 0, 0, 0))
    ImageDraw.Draw(img).text((4, 2), text, font=font, fill=(255, 255, 255, 120))
    path = ROOT / "tools" / f".wm-{size}.png"
    img.save(path)
    return path


def make_mp4(name: str, w: int, h: int, seconds: int, fps: int = 25, crf: int = 29) -> Path:
    """A slow Ken Burns pan over the sample still with title cards and a drifting watermark."""
    out = MEDIA / name
    frames = seconds * fps
    zoom_w = int(w * 1.6)

    title = _text_layer(
        w,
        h,
        [
            ("CINEJOY", w // 14, 0.40, (255, 255, 255, 242)),
            ("SAMPLE REEL", w // 40, 0.525, (255, 255, 255, 160)),
            ("this title ships with a demo stream", w // 64, 0.595, (255, 255, 255, 110)),
        ],
    )
    wm = _watermark("cinejoy.pk  ·  sample", max(11, w // 58))

    vf = ",".join(
        [
            f"scale={zoom_w}:-2",
            f"zoompan=z='min(zoom+0.00035,1.22)':x='iw/2-(iw/zoom/2)+sin(on/220)*40'"
            f":y='ih/2-(ih/zoom/2)+cos(on/300)*26':d={frames}:s={w}x{h}:fps={fps}",
            "format=rgba[bg]",
            "[bg][1:v]overlay=0:0:format=auto[card]",
            f"[card][2:v]overlay=x='mod(t*{(w // 80) + 24},W+overlay_w*2)-overlay_w*2':y='H-overlay_h-{max(14, h // 26)}':format=auto[v]",
        ]
    )
    run(
        [
            FFMPEG,
            "-y",
            "-loop",
            "1",
            "-i",
            str(STILL),
            "-i",
            str(title),
            "-loop",
            "1",
            "-i",
            str(wm),
            "-f",
            "lavfi",
            "-i",
            f"sine=frequency=196:sample_rate=44100:duration={seconds}",
            "-filter_complex",
            f"[0:v]{vf};[3:a]volume=0.05,afade=t=in:st=0:d=1.5,afade=t=out:st={max(0, seconds - 2)}:d=2[a]",
            "-map",
            "[v]",
            "-map",
            "[a]",
            "-t",
            str(seconds),
            "-r",
            str(fps),
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            str(crf),
            "-profile:v",
            "main",
            "-level",
            "4.0",
            "-pix_fmt",
            "yuv420p",
            "-g",
            str(fps * 2),
            "-c:a",
            "aac",
            "-b:a",
            "64k",
            "-ac",
            "1",
            "-movflags",
            "+faststart",
            str(out),
        ]
    )
    title.unlink(missing_ok=True)
    wm.unlink(missing_ok=True)
    return out


def make_poster() -> None:
    img = Image.open(STILL).convert("RGB")
    w, h = img.size
    target = (int(h * 2 / 3), h)
    left = (w - target[0]) // 2
    poster = img.crop((left, 0, left + target[0], h)).resize((640, 960), Image.LANCZOS)
    # cinematic darkening at the bottom where the caption sits
    overlay = Image.new("RGBA", poster.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    for i in range(260):
        d.line([(0, 960 - i), (640, 960 - i)], fill=(5, 5, 8, int(230 * (i / 260) ** 1.4)))
    poster = Image.alpha_composite(poster.convert("RGBA"), overlay).convert("RGB")
    poster.save(MEDIA / "poster.jpg", quality=86, optimize=True)


def rounded(im: Image.Image, radius: int) -> Image.Image:
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, im.size[0], im.size[1]], radius=radius, fill=255)
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    return out


def trim_icon(img: Image.Image) -> Image.Image:
    """Crop the generated artwork to the rounded-square icon inside it."""
    w, h = img.size
    # the generated icon sits centred with generous padding
    inset = int(w * 0.155)
    return img.crop((inset, inset, w - inset, h - inset))


def make_icons() -> None:
    src = Image.open(ICON).convert("RGBA")
    mark = trim_icon(src)
    size = 1024
    mark = mark.resize((size, size), Image.LANCZOS)

    def flat(bg: tuple[int, int, int] = (8, 8, 11)) -> Image.Image:
        canvas = Image.new("RGBA", (size, size), bg + (255,))
        return Image.alpha_composite(canvas, mark)

    base = flat()
    base.resize((512, 512), Image.LANCZOS).save(ICONS / "icon-512.png", optimize=True)
    base.resize((192, 192), Image.LANCZOS).save(ICONS / "icon-192.png", optimize=True)
    base.resize((180, 180), Image.LANCZOS).save(ICONS / "apple-touch-icon.png", optimize=True)
    base.resize((32, 32), Image.LANCZOS).save(ICONS / "favicon-32.png", optimize=True)

    # maskable icon: extra safe-zone padding
    maskable = Image.new("RGBA", (size, size), (8, 8, 11, 255))
    inner = mark.resize((int(size * 0.72), int(size * 0.72)), Image.LANCZOS)
    maskable.alpha_composite(inner, ((size - inner.size[0]) // 2, (size - inner.size[1]) // 2))
    maskable.resize((512, 512), Image.LANCZOS).save(ICONS / "maskable-512.png", optimize=True)

    # splash / poster art for the loading screen (blurred glow + mark)
    splash = Image.new("RGBA", (1080, 1920), (5, 5, 8, 255))
    glow = Image.new("RGBA", (1080, 1920), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([-260, 240, 1340, 1200], fill=(255, 46, 99, 60))
    gd.ellipse([120, 900, 1300, 1800], fill=(255, 138, 61, 42))
    glow = glow.filter(ImageFilter.GaussianBlur(160))
    splash = Image.alpha_composite(splash, glow)
    logo = mark.resize((420, 420), Image.LANCZOS)
    splash.alpha_composite(logo, ((1080 - 420) // 2, 1920 // 2 - 300))
    sd = ImageDraw.Draw(splash)
    sd.text((1080 // 2, 1920 // 2 + 170), "CINEJOY", font=None, fill=(245, 245, 247, 255), anchor="mm") if False else None
    splash.convert("RGB").save(ICONS / "splash.png", optimize=True)
    print("  icons written")


def make_splash_animation() -> None:
    """Small animated logo used behind the first load (webm + mp4)."""
    frames_dir = ROOT / "tools" / ".frames"
    frames_dir.mkdir(parents=True, exist_ok=True)
    for f in frames_dir.glob("*.png"):
        f.unlink()

    base = Image.open(ICONS / "icon-512.png").convert("RGBA")
    total = 60
    for i in range(total):
        t = i / total
        canvas = Image.new("RGBA", (512, 512), (8, 8, 11, 255))
        scale = 0.86 + 0.06 * math.sin(t * math.pi * 2)
        glow = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
        gd = ImageDraw.Draw(glow)
        r = int(150 + 24 * math.sin(t * math.pi * 2))
        gd.ellipse([256 - r, 256 - r, 256 + r, 256 + r], fill=(255, 70, 100, 70))
        glow = glow.filter(ImageFilter.GaussianBlur(60))
        canvas = Image.alpha_composite(canvas, glow)
        mark = base.resize((int(330 * scale), int(330 * scale)), Image.LANCZOS)
        canvas.alpha_composite(mark, ((512 - mark.size[0]) // 2, (512 - mark.size[1]) // 2))
        canvas.convert("RGB").save(frames_dir / f"f{i:03d}.png")

    run(
        [
            FFMPEG, "-y", "-framerate", "30", "-i", str(frames_dir / "f%03d.png"),
            "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "40", "-pix_fmt", "yuv420p",
            "-an", str(ICONS / "splash.webm"),
        ]
    )
    run(
        [
            FFMPEG, "-y", "-framerate", "30", "-i", str(frames_dir / "f%03d.png"),
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "30", "-pix_fmt", "yuv420p",
            "-movflags", "+faststart", "-an", str(ICONS / "splash.mp4"),
        ]
    )
    shutil.rmtree(frames_dir, ignore_errors=True)


def make_hls() -> None:
    """Three-rendition HLS ladder so the in-player quality picker is real."""
    out = MEDIA / "sample-hls"
    for f in out.glob("*"):
        f.unlink()

    # (width, height, bitrate, source file, declared bandwidth)
    ladder = [
        (1280, 720, "1400k", "sample-720.mp4", 1600 * 1000),
        (960, 540, "800k", "sample-540.mp4", 950 * 1000),
        (640, 360, "400k", "sample-480.mp4", 520 * 1000),
    ]
    for idx, (w, h, vb, src_name, kbps) in enumerate(ladder):
        src = MEDIA / src_name
        run(
            [
                FFMPEG, "-y", "-i", str(src), "-vf", f"scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2",
                "-c:v", "libx264", "-preset", "veryfast", "-g", "50", "-keyint_min", "50", "-sc_threshold", "0",
                "-b:v", vb, "-maxrate", vb, "-bufsize", f"{int(vb[:-1]) * 2}k",
                "-c:a", "aac", "-b:a", "64k", "-ac", "1",
                "-f", "hls", "-hls_time", "4", "-hls_playlist_type", "vod",
                "-hls_segment_filename", str(out / f"v{idx}_%03d.ts"),
                str(out / f"v{idx}.m3u8"),
            ]
        )

    master = [
        "#EXTM3U",
        "#EXT-X-VERSION:3",
    ]
    for idx, (w, h, vb, _src, kbps) in enumerate(ladder):
        master.append(f"#EXT-X-STREAM-INF:BANDWIDTH={kbps},RESOLUTION={w}x{h},CODECS=\"avc1.4d401f,mp4a.40.2\"")
        master.append(f"v{idx}.m3u8")
    (out / "master.m3u8").write_text("\n".join(master) + "\n")
    print("  hls written")


def main() -> int:
    if not STILL.exists() or not ICON.exists():
        print("Missing source artwork in app/assets/", file=sys.stderr)
        return 1
    ensure_dirs()
    print("ffmpeg:", FFMPEG)
    print("• 720p sample")
    make_mp4("sample-720.mp4", 1280, 720, 60, crf=29)
    print("• 480p sample")
    make_mp4("sample-480.mp4", 854, 480, 45, crf=30)
    print("• 540p sample")
    make_mp4("sample-540.mp4", 960, 540, 30, crf=30)
    print("• poster")
    make_poster()
    print("• icons")
    make_icons()
    print("• splash animation")
    make_splash_animation()
    print("• HLS ladder")
    make_hls()

    manifest = {}
    for p in sorted(MEDIA.rglob("*")):
        if p.is_file():
            manifest[str(p.relative_to(PUBLIC))] = p.stat().st_size
    (MEDIA / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    total = sum(manifest.values())
    print(f"done — {len(manifest)} files, {total / 1048576:.1f} MB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
