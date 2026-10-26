#!/usr/bin/env python3
"""Generates the WikiRush brand art used by the watermark and legacy social card.

Run:  python3 scripts/make-wikirush-art.py      (needs: pip install pillow numpy)
Writes public/wikirush/:
  wr-mark.png          transparent watermark mark (split circle + link path)
  wr-og.png            1200x630  social card for /wikirush
Deterministic: the same script always writes the same pixels.
"""
import math
import os
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'public', 'wikirush')
FONT = os.path.join(ROOT, 'src', 'assets', 'Poppins-Bold.ttf')
os.makedirs(OUT, exist_ok=True)

NAVY = np.array([16, 20, 38], dtype=np.float32)
INK2 = np.array([10, 13, 26], dtype=np.float32)
INDIGO = np.array([105, 120, 245], dtype=np.float32)
PINK = np.array([231, 93, 135], dtype=np.float32)
SOFT = (174, 183, 255)
WHITE = (255, 255, 255)


def font(size):
    return ImageFont.truetype(FONT, size)


def glow_bg(w, h, seed):
    """Navy field with an indigo glow top-right and a pink glow bottom-left."""
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    base = NAVY * (1 - ys[..., None] / h * 0.55) + INK2 * (ys[..., None] / h * 0.55)
    long_side = max(w, h)
    for color, cx, cy, r, k in ((INDIGO, 0.92, 0.05, 0.75, 0.55), (PINK, 0.02, 1.0, 0.55, 0.30)):
        d = np.sqrt((xs - cx * w) ** 2 + (ys - cy * h) ** 2) / (r * long_side)
        a = np.clip(1 - d, 0, 1) ** 2 * k
        base = base * (1 - a[..., None]) + color * a[..., None]
    return Image.fromarray(np.clip(base, 0, 255).astype(np.uint8), 'RGB').convert('RGBA')


def link_network(w, h, seed, nodes=46, alpha=70):
    """Faint web of connected 'pages': the visual idea of the game."""
    rnd = random.Random(seed)
    layer = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    pts = [(rnd.uniform(0, w), rnd.uniform(0, h)) for _ in range(nodes)]
    reach = max(w, h) * 0.24
    for i, (x1, y1) in enumerate(pts):
        for x2, y2 in pts[i + 1:]:
            dist = math.hypot(x1 - x2, y1 - y2)
            if dist < reach:
                a = int(alpha * (1 - dist / reach))
                d.line([(x1, y1), (x2, y2)], fill=SOFT + (a,), width=2)
    for x, y in pts:
        r = rnd.choice((3, 4, 5, 7))
        d.ellipse([x - r, y - r, x + r, y + r], fill=SOFT + (min(255, alpha + 60),))
    return layer.filter(ImageFilter.GaussianBlur(0.6))


def draw_mark(size):
    """Duelio split circle with a white link path running through it."""
    s = size * 4
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pad = int(s * 0.04)
    box = [pad, pad, s - pad, s - pad]
    d.pieslice(box, 90, 270, fill=(105, 120, 245, 255))
    d.pieslice(box, 270, 90, fill=(231, 93, 135, 255))
    pts = [(0.24, 0.66), (0.42, 0.36), (0.58, 0.62), (0.76, 0.32)]
    xy = [(x * s, y * s) for x, y in pts]
    d.line(xy, fill=WHITE + (255,), width=int(s * 0.055), joint='curve')
    for i, (x, y) in enumerate(xy):
        r = s * (0.062 if i in (0, len(xy) - 1) else 0.048)
        d.ellipse([x - r, y - r, x + r, y + r], fill=WHITE + (255,))
    ex, ey = xy[-1]
    r2 = s * 0.026
    d.ellipse([ex - r2, ey - r2, ex + r2, ey + r2], fill=(16, 20, 38, 255))
    return img.resize((size, size), Image.LANCZOS)


def paste_center(base, layer, cx, cy):
    base.alpha_composite(layer, (int(cx - layer.width / 2), int(cy - layer.height / 2)))


def text_c(d, xy, txt, f, fill):
    d.text(xy, txt, font=f, fill=fill, anchor='mm')


def make_bg(w, h, seed, with_text=False):
    img = glow_bg(w, h, seed)
    img.alpha_composite(link_network(w, h, seed, nodes=int(w * h / 18000), alpha=60))
    return img


def main():
    mark = draw_mark(256)
    mark.save(os.path.join(OUT, 'wr-mark.png'), optimize=True)

    og = make_bg(1200, 630, 7)
    d = ImageDraw.Draw(og)
    paste_center(og, draw_mark(120), 150, 150)
    d.text((228, 150), 'DUELIO', font=font(40), fill=SOFT, anchor='lm')
    d.text((84, 330), 'WikiRush', font=font(132), fill=WHITE, anchor='lm')
    d.text((88, 440), 'GeoGuessr for Wikipedia.', font=font(46), fill=SOFT, anchor='lm')
    d.text((88, 505), 'Race from one page to another. 90 seconds. Links only.', font=font(30), fill=(210, 216, 255), anchor='lm')
    pill = Image.new('RGBA', (1200, 630), (0, 0, 0, 0))
    pd = ImageDraw.Draw(pill)
    pd.rounded_rectangle([84, 540, 460, 596], radius=28, fill=(105, 120, 245, 255))
    pd.text((272, 568), 'duelio.ink/wikirush', font=font(28), fill=WHITE, anchor='mm')
    og.alpha_composite(pill)
    og.convert('RGB').save(os.path.join(OUT, 'wr-og.png'), optimize=True)
    print('wrote', sorted(os.listdir(OUT)))


if __name__ == '__main__':
    main()
