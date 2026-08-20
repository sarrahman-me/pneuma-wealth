#!/usr/bin/env python3
"""
Pembuat ikon PNEUMA.

Ikon digambar dari kode supaya bisa dibuat ulang persis kapan saja — ukuran
baru cukup ditambahkan di TARGETS, tidak perlu menyunting berkas gambar.

Lambangnya adalah napas: satu titik tenang di tengah dengan lingkaran-lingkaran
yang mengembang keluar dan memudar. Titik tengah sengaja dibuat dominan supaya
bentuknya tetap terbaca saat ikon dikecilkan jadi 16 piksel di tab peramban.

Jalankan: python3 scripts/generate-icons.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent

# Warna diambil dari token tema di app/globals.css supaya ikon dan aplikasi
# terasa berasal dari keluarga yang sama.
INK = (28, 27, 25, 255)  # --bg (mode gelap) / --accent
INK_GLOW = (46, 43, 38, 255)
CREAM = (246, 243, 238)  # --bg terang
CALM = (127, 191, 169)  # --calm (mode gelap)
WARM = (222, 205, 179)  # gema hangat dari --chart-obligation

SS = 4  # supersampling; digambar besar lalu dikecilkan agar tepinya halus

# (radius, tebal garis, warna, opasitas, busur) — semuanya pecahan dari sisi
# ikon. radius 0 berarti bulatan padat; busur None berarti lingkaran utuh.
#
# Dua lingkaran terluar sengaja terbuka di bawah dan makin lebar bukaannya
# makin jauh dari pusat: itu yang membuat lambang ini terbaca sebagai napas
# yang mengembang, bukan sebagai lensa kamera.
RINGS = [
    (0.000, 0.115, CREAM, 255, None),
    (0.205, 0.034, CALM, 255, None),
    (0.300, 0.026, WARM, 150, (118, 62)),
    (0.395, 0.020, WARM, 74, (140, 40)),
]


def draw_backdrop(draw: ImageDraw.ImageDraw, size: int, radius_ratio: float) -> None:
    """Latar tinta hangat, dengan sudut membulat bila diminta."""
    if radius_ratio <= 0:
        draw.rectangle((0, 0, size, size), fill=INK)
    else:
        draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=int(size * radius_ratio), fill=INK)


def draw_glow(base: Image.Image, size: int) -> None:
    """Cahaya lembut di kiri atas supaya latar tidak terasa datar."""
    glow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    pen = ImageDraw.Draw(glow)
    steps = 26
    for step in range(steps):
        span = size * (0.30 + 0.62 * step / steps)
        cx, cy = size * 0.33, size * 0.28
        alpha = int(9 * (1 - step / steps))
        pen.ellipse((cx - span, cy - span, cx + span, cy + span), fill=INK_GLOW[:3] + (alpha,))
    base.alpha_composite(glow)


def draw_mark(base: Image.Image, size: int, scale: float) -> None:
    """Lambang napas di tengah ikon."""
    mark = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    pen = ImageDraw.Draw(mark)
    cx = cy = size / 2

    for radius, weight, colour, alpha, arc in RINGS:
        r = radius * size * scale
        w = weight * size * scale
        fill = colour + (alpha,)
        if radius == 0:
            pen.ellipse((cx - w, cy - w, cx + w, cy + w), fill=fill)
        elif arc is None:
            pen.ellipse(
                (cx - r, cy - r, cx + r, cy + r),
                outline=fill,
                width=max(1, round(w)),
            )
        else:
            start, end = arc
            pen.arc(
                (cx - r, cy - r, cx + r, cy + r),
                start=start,
                end=end,
                fill=fill,
                width=max(1, round(w)),
            )
    base.alpha_composite(mark)


def render(size: int, *, corner: float, mark_scale: float, opaque: bool) -> Image.Image:
    big = size * SS
    base = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    draw_backdrop(ImageDraw.Draw(base), big, corner)
    draw_glow(base, big)
    draw_mark(base, big, mark_scale)

    out = base.resize((size, size), Image.LANCZOS)
    if opaque:
        flat = Image.new('RGBA', (size, size), INK)
        flat.alpha_composite(out)
        out = flat.convert('RGB')
    return out


# corner: 0 = penuh sampai tepi. mark_scale < 1 menjaga lambang tetap di dalam
# zona aman ikon maskable (80% bagian tengah) saat Android memotongnya jadi
# lingkaran atau bentuk lain.
TARGETS = [
    ('public/icons/icon-192.png', 192, 0.22, 1.0, False),
    ('public/icons/icon-512.png', 512, 0.22, 1.0, False),
    ('public/icons/maskable-192.png', 192, 0.0, 0.72, False),
    ('public/icons/maskable-512.png', 512, 0.0, 0.72, False),
    ('app/apple-icon.png', 180, 0.0, 0.88, True),
    ('app/icon.png', 512, 0.22, 1.0, False),
]


def main() -> None:
    for path, size, corner, mark_scale, opaque in TARGETS:
        image = render(size, corner=corner, mark_scale=mark_scale, opaque=opaque)
        target = ROOT / path
        target.parent.mkdir(parents=True, exist_ok=True)
        image.save(target)
        print(f'{path} ({size}x{size})')


if __name__ == '__main__':
    main()
