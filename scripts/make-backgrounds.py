#!/usr/bin/env python3
"""Generates the calm paper-and-glow backgrounds used behind the share cards.

Run:  python3 scripts/make-backgrounds.py     (needs: pip install pillow numpy)
Writes src/assets/bg-<tone>-<format>.jpg for tones a (blue), b (pink), n (neutral)
and formats story, portrait, square, wide.
"""
import os
import numpy as np
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'assets')
SIZES = {'story': (1080, 1920), 'portrait': (1080, 1350), 'square': (1080, 1080), 'wide': (1200, 630)}
BLUE = np.array([36, 51, 224], dtype=np.float32)
PINK = np.array([200, 30, 75], dtype=np.float32)
INK = (20, 22, 43)
TOP = np.array([248, 249, 253], dtype=np.float32)
BOTTOM = np.array([232, 235, 244], dtype=np.float32)

# tone -> list of (colour, centre x, centre y, radius as share of the long side, strength)
TONES = {
    'a': [(BLUE, 0.88, 0.10, 0.62, 0.23), (PINK, 0.06, 0.98, 0.34, 0.10)],
    'b': [(PINK, 0.88, 0.10, 0.62, 0.20), (BLUE, 0.06, 0.98, 0.34, 0.10)],
    'n': [(BLUE, 0.08, 0.04, 0.55, 0.15), (PINK, 0.94, 0.98, 0.55, 0.15)],
}

def make(tone, fmt):
    w, h = SIZES[fmt]
    ys = np.linspace(0, 1, h, dtype=np.float32)[:, None, None]
    img = TOP * (1 - ys) + BOTTOM * ys
    img = np.broadcast_to(img, (h, w, 3)).copy()
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    long_side = max(w, h)
    for colour, cx, cy, rad, strength in TONES[tone]:
        d2 = (xx - cx * w) ** 2 + (yy - cy * h) ** 2
        sigma = rad * long_side * 0.55
        a = (strength * np.exp(-d2 / (2 * sigma ** 2)))[..., None]
        img = img * (1 - a) + colour * a
    rng = np.random.default_rng(7)
    img += rng.normal(0, 1.6, (h, w, 1)).astype(np.float32)  # fine paper grain
    im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), 'RGB').convert('RGBA')
    inset = 22 if fmt == 'wide' else 36
    frame = Image.new('RGBA', im.size, (0, 0, 0, 0))
    ImageDraw.Draw(frame).rectangle([inset, inset, w - inset, h - inset], outline=INK + (30,), width=2)
    out = Image.alpha_composite(im, frame).convert('RGB')
    path = os.path.join(OUT, f'bg-{tone}-{fmt}.jpg')
    out.save(path, quality=84, optimize=True, progressive=True)
    return path

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for t in TONES:
        for f in SIZES:
            p = make(t, f)
            print(os.path.basename(p), os.path.getsize(p) // 1024, 'KB')
