#!/usr/bin/env python3
"""Generates the Duelio / WikiRush game art. Deterministic; run: python3 scripts/make-game-art.py

Writes public/game/:
  hero.jpg, hero-mobile.jpg      night-sky world with a glowing page-to-page route (and Mars)
  auth.jpg                       tall portal scene for the sign-in screen
  mode-*.jpg                     one illustrated card per game mode
  pip.png                        the mascot
  level-1..7.png                 explorer emblems
  avatar-01..12.png              profile pictures
  og.png                         1200x630 social card
"""
import math, os, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'public', 'game')
FONT = os.path.join(ROOT, 'src', 'assets', 'Poppins-Bold.ttf')
os.makedirs(OUT, exist_ok=True)

BG = np.array([8, 11, 30], dtype=np.float32)
INDIGO = (105, 120, 245); VIOLET = (139, 92, 246); MINT = (52, 211, 153)
AMBER = (251, 191, 36); CORAL = (251, 113, 133); SKY = (56, 189, 248); WHITE = (255, 255, 255)


def font(size): return ImageFont.truetype(FONT, size)
def lerp(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def vgrad(w, h, top, bottom):
    t = np.linspace(0, 1, h, dtype=np.float32)[:, None, None]
    arr = np.array(top, np.float32) * (1 - t) + np.array(bottom, np.float32) * t
    return Image.fromarray(np.repeat(arr, w, axis=1).astype(np.uint8), 'RGB').convert('RGBA')


def radial(w, h, cx, cy, r, color, strength=1.0, power=2.0):
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2) / r
    a = (np.clip(1 - d, 0, 1) ** power * strength)
    layer = np.zeros((h, w, 4), np.uint8)
    layer[..., 0], layer[..., 1], layer[..., 2] = color
    layer[..., 3] = np.clip(a * 255, 0, 255).astype(np.uint8)
    return Image.fromarray(layer, 'RGBA')


def glow(img, xy_fn, radius, passes=2):
    """Draw with xy_fn on a transparent layer, blur it, and composite twice for bloom."""
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    xy_fn(ImageDraw.Draw(layer))
    soft = layer.filter(ImageFilter.GaussianBlur(radius))
    for _ in range(passes): img.alpha_composite(soft)
    img.alpha_composite(layer)


def noise_stars(img, rnd, count, maxr=2.6):
    w, h = img.size
    def draw(d):
        for _ in range(count):
            x, y = rnd.uniform(0, w), rnd.uniform(0, h * 0.8)
            r = rnd.choice([0.7, 0.9, 1.1, 1.4, maxr * rnd.random() + 1.2])
            a = int(120 + 135 * rnd.random())
            tint = rnd.choice([WHITE, (200, 210, 255), (255, 235, 200)])
            d.ellipse([x - r, y - r, x + r, y + r], fill=tint + (a,))
    glow(img, draw, 2.2, passes=1)


def aurora(img, rnd, colors):
    w, h = img.size
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    out = np.zeros((h, w, 3), np.float32)
    for i, col in enumerate(colors):
        phase = rnd.uniform(0, 6.28); amp = h * rnd.uniform(0.05, 0.1); freq = rnd.uniform(1.0, 2.2)
        center = h * (0.22 + 0.12 * i) + amp * np.sin(xs / w * freq * 6.28 + phase)
        thick = h * rnd.uniform(0.07, 0.13)
        band = np.exp(-((ys - center) / thick) ** 2) * (0.55 + 0.45 * np.sin(xs / w * 9 + phase))
        out += band[..., None] * np.array(col, np.float32) * 0.5
    layer = np.clip(out, 0, 255).astype(np.uint8)
    a = np.clip(out.max(axis=2) * 1.2, 0, 255).astype(np.uint8)
    arr = np.dstack([layer, a])
    lay = Image.fromarray(arr, 'RGBA').filter(ImageFilter.GaussianBlur(h * 0.02))
    img.alpha_composite(lay)


def planet(img, cx, cy, r, base, shade, rim, ring=None, craters=0, rnd=None):
    ss = 3
    size = int(r * 2.6) * ss
    p = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    c = size // 2; R = r * ss
    ys, xs = np.mgrid[0:size, 0:size].astype(np.float32)
    dx, dy = (xs - c) / R, (ys - c) / R
    dist = np.sqrt(dx ** 2 + dy ** 2)
    inside = dist <= 1
    lx, ly = -0.55, -0.6
    lit = np.clip(1 - np.sqrt((dx - lx) ** 2 + (dy - ly) ** 2) / 1.55, 0, 1) ** 1.2
    col = np.array(shade, np.float32) * (1 - lit[..., None]) + np.array(base, np.float32) * lit[..., None]
    edge = np.clip((dist - 0.86) / 0.14, 0, 1)[..., None] ** 2
    col = col * (1 - edge * 0.25) + np.array(rim, np.float32) * edge * 0.25
    arr = np.zeros((size, size, 4), np.uint8)
    arr[..., :3] = np.clip(col, 0, 255).astype(np.uint8)
    arr[..., 3] = (inside * 255).astype(np.uint8)
    p = Image.fromarray(arr, 'RGBA')
    d = ImageDraw.Draw(p, 'RGBA')
    if craters and rnd:
        for _ in range(craters):
            a = rnd.uniform(0, 6.28); rr = rnd.uniform(0, 0.7)
            x, y = c + math.cos(a) * rr * R, c + math.sin(a) * rr * R
            s = rnd.uniform(0.05, 0.13) * R
            s *= .8
            d.ellipse([x - s, y - s, x + s, y + s], fill=tuple(int(v * 0.8) for v in shade) + (38,))
    if ring:
        rl = Image.new('RGBA', (size, size), (0, 0, 0, 0)); rd = ImageDraw.Draw(rl)
        for k, w_ in ((1.55, 14), (1.8, 7), (2.0, 4)):
            rd.ellipse([c - R * k, c - R * k * .28, c + R * k, c + R * k * .28], outline=ring + (150 - int(k * 20),), width=w_ * ss // 3)
        rl = rl.rotate(-18, resample=Image.BICUBIC, center=(c, c))
        mask = Image.new('L', (size, size), 0); md = ImageDraw.Draw(mask); md.ellipse([c - R, c - R, c + R, c + R], fill=255)
        front = Image.new('RGBA', (size, size), (0, 0, 0, 0)); front.paste(rl, (0, 0))
        p = Image.alpha_composite(p, front)
    p = p.resize((size // ss, size // ss), Image.LANCZOS)
    halo = radial(img.size[0], img.size[1], cx, cy, r * 2.6, rim, 0.35, 2.2)
    img.alpha_composite(halo)
    img.alpha_composite(p, (int(cx - p.size[0] / 2), int(cy - p.size[1] / 2)))


def ridges(img, rnd, layers):
    w, h = img.size
    for i, (base_y, amp, color, fog) in enumerate(layers):
        xs = np.arange(w)
        y = base_y * h + sum(amp * h * rnd.uniform(.3, 1) * np.sin(xs / w * rnd.uniform(2, 9) * 6.28 + rnd.uniform(0, 6.28)) / (k + 1) for k in range(4))
        mask = Image.new('L', (w, h), 0); d = ImageDraw.Draw(mask)
        d.polygon([(0, h)] + [(int(x), int(v)) for x, v in zip(xs, y)] + [(w, h)], fill=255)
        layer = Image.new('RGBA', (w, h), color + (255,)); layer.putalpha(mask)
        img.alpha_composite(layer)
        if fog:
            f = vgrad(w, h, (0, 0, 0), (0, 0, 0)); f = radial(w, h, w / 2, base_y * h, w * .7, fog, .18, 1.6)
            img.alpha_composite(f)


def route_network(img, rnd, nodes, route, edge_alpha=60, bounds=None):
    w, h = img.size
    x0, y0, x1, y1 = bounds or (0, 0, w, h)
    pts = [(rnd.uniform(x0, x1), rnd.uniform(y0, y1)) for _ in range(nodes)]
    reach = max(w, h) * 0.16
    def faint(d):
        for i, (ax, ay) in enumerate(pts):
            for bx, by in pts[i + 1:]:
                dist = math.hypot(ax - bx, ay - by)
                if dist < reach: d.line([(ax, ay), (bx, by)], fill=(174, 183, 255, int(edge_alpha * (1 - dist / reach))), width=2)
        for x, y in pts:
            r = rnd.uniform(2.5, 6); d.ellipse([x - r, y - r, x + r, y + r], fill=(190, 200, 255, 150))
    glow(img, faint, 3, passes=1)
    # golden route through hand-placed anchors (fractions of the frame)
    rp = [(fx * w, fy * h) for fx, fy in route]
    def gold(d):
        d.line(rp, fill=AMBER + (255,), width=max(4, w // 380), joint='curve')
    glow(img, gold, w * .006, passes=2)
    def dots(d):
        for i, (x, y) in enumerate(rp):
            r = w * (.011 if i in (0, len(rp) - 1) else .007)
            d.ellipse([x - r * 1.9, y - r * 1.9, x + r * 1.9, y + r * 1.9], fill=AMBER + (70,))
            d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 244, 214, 255) if i not in (0, len(rp) - 1) else ((130, 255, 200, 255) if i == 0 else (255, 150, 150, 255)))
    glow(img, dots, w * .004, passes=1)
    return rp


def scene(w, h, seed, route, mars=(0.82, 0.62, 0.095), moon=(0.12, 0.2, 0.045)):
    rnd = random.Random(seed)
    img = vgrad(w, h, (6, 9, 28), (22, 24, 64))
    img.alpha_composite(radial(w, h, w * .5, h * 1.05, w * .75, (231, 93, 135), .35, 2))
    img.alpha_composite(radial(w, h, w * .85, h * .05, w * .65, INDIGO, .4, 2))
    aurora(img, rnd, [MINT, INDIGO, VIOLET])
    noise_stars(img, rnd, int(w * h / 4500))
    planet(img, moon[0] * w, moon[1] * h, moon[2] * w, (215, 220, 255), (70, 80, 150), (170, 180, 255), ring=(190, 200, 255), rnd=rnd)
    rp = route_network(img, rnd, 54, route, bounds=(0, h * .08, w, h * .72))
    planet(img, mars[0] * w, mars[1] * h, mars[2] * w, (255, 150, 110), (120, 40, 40), (255, 140, 100), craters=16, rnd=rnd)
    ridges(img, rnd, [(.80, .035, (22, 22, 60), (120, 100, 255)), (.88, .03, (14, 14, 42), (231, 93, 135)), (.95, .02, (8, 9, 26), None)])
    # soft vignette
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    v = 1 - np.clip(((xs / w - .5) ** 2 + (ys / h - .5) ** 2) * 1.1, 0, .55)
    arr = np.array(img.convert('RGB'), np.float32) * v[..., None]
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGB')


def make_heroes():
    scene(2560, 1440, 7, [(.08, .62), (.2, .45), (.34, .55), (.47, .3), (.6, .42), (.68, .52), (.728, .595)]).save(f'{OUT}/hero.jpg', quality=88)
    scene(1170, 1800, 11, [(.18, .55), (.35, .42), (.3, .3), (.55, .22), (.6, .36), (.66, .5)], mars=(.78, .55, .17), moon=(.2, .1, .08)).save(f'{OUT}/hero-mobile.jpg', quality=88)
    scene(1200, 1500, 21, [(.2, .7), (.4, .55), (.35, .38), (.5, .32), (.64, .66)], mars=(.78, .72, .16), moon=(.82, .13, .08)).save(f'{OUT}/auth.jpg', quality=88)


# ---------------------------------------------------------------- modes
def ss_canvas(w, h, ss=2):
    return Image.new('RGBA', (w * ss, h * ss), (0, 0, 0, 0)), ss


def mode_card(name, top, bottom, accent, motif, seed):
    w, h = 960, 600
    rnd = random.Random(seed)
    img = vgrad(w, h, top, bottom)
    img.alpha_composite(radial(w, h, w * .75, h * .3, w * .6, accent, .55, 2))
    noise_stars(img, rnd, 90, 1.8)
    layer, ss = ss_canvas(w, h)
    d = ImageDraw.Draw(layer)
    motif(d, w * ss, h * ss, accent, rnd)
    layer = layer.resize((w, h), Image.LANCZOS)
    glow(img, lambda dd: None, 1, 0)
    soft = layer.filter(ImageFilter.GaussianBlur(10)); img.alpha_composite(soft); img.alpha_composite(layer)
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    v = 1 - np.clip(((xs / w - .5) ** 2 + (ys / h - .5) ** 2) * .9, 0, .5)
    arr = np.array(img.convert('RGB'), np.float32) * v[..., None]
    Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).save(f'{OUT}/mode-{name}.jpg', quality=88)


def star_poly(cx, cy, r1, r2, n, rot=-math.pi / 2):
    return [(cx + math.cos(rot + i * math.pi / n) * (r1 if i % 2 == 0 else r2), cy + math.sin(rot + i * math.pi / n) * (r1 if i % 2 == 0 else r2)) for i in range(2 * n)]


def m_daily(d, w, h, c, rnd):  # sunrise over a calendar of stars
    cx, cy = w * .72, h * .56
    for k in range(9):
        a = math.pi + k * math.pi / 8
        d.line([(cx + math.cos(a) * w * .12, cy + math.sin(a) * w * .12), (cx + math.cos(a) * w * .22, cy + math.sin(a) * w * .22)], fill=c + (230,), width=int(w * .012))
    d.pieslice([cx - w * .11, cy - w * .11, cx + w * .11, cy + w * .11], 180, 360, fill=(255, 236, 170, 255))
    d.rounded_rectangle([w * .1, h * .28, w * .45, h * .78], radius=int(w * .03), fill=(255, 255, 255, 235))
    d.rounded_rectangle([w * .1, h * .28, w * .45, h * .42], radius=int(w * .03), fill=c + (255,))
    for r in range(3):
        for k in range(4):
            x, y = w * (.14 + k * .075), h * (.5 + r * .085)
            d.ellipse([x, y, x + w * .042, y + w * .042], fill=(16, 20, 50, 255) if (r, k) != (1, 2) else c + (255,))


def m_quick(d, w, h, c, rnd):  # rocket + speed lines
    for i in range(8):
        y = h * (.2 + i * .08); x0 = w * rnd.uniform(.05, .3)
        d.line([(x0, y), (x0 + w * rnd.uniform(.2, .35), y)], fill=(255, 255, 255, 120), width=int(w * .006))
    cx, cy = w * .62, h * .5
    d.polygon([(cx - w * .26, cy + h * .06), (cx - w * .02, cy - h * .02), (cx - w * .02, cy + h * .14)], fill=(255, 190, 80, 255))
    d.ellipse([cx - w * .12, cy - h * .12, cx + w * .26, cy + h * .2], fill=(244, 246, 255, 255))
    d.polygon([(cx + w * .26, cy + h * .04), (cx + w * .36, cy + h * .04), (cx + w * .26, cy - h * .06)], fill=c + (255,))
    d.ellipse([cx + w * .05, cy - h * .06, cx + w * .13, cy + h * .06], fill=c + (255,))
    d.polygon([(cx - w * .02, cy - h * .05), (cx + w * .06, cy - h * .2), (cx + w * .1, cy - h * .09)], fill=c + (255,))
    d.polygon([(cx - w * .02, cy + h * .13), (cx + w * .06, cy + h * .27), (cx + w * .1, cy + h * .16)], fill=c + (255,))


def m_hard(d, w, h, c, rnd):  # jagged peaks and a flag
    pts = [(0, h)]
    xs = [0, .14, .26, .38, .5, .62, .76, .9, 1]
    ys = [.78, .52, .66, .34, .62, .26, .58, .44, .7]
    pts += [(w * x, h * y) for x, y in zip(xs, ys)] + [(w, h)]
    d.polygon(pts, fill=(30, 18, 40, 255))
    d.polygon([(w * .62, h * .26), (w * .56, h * .44), (w * .68, h * .4)], fill=(255, 255, 255, 235))
    d.polygon([(w * .38, h * .34), (w * .33, h * .5), (w * .43, h * .46)], fill=(255, 255, 255, 220))
    d.line([(w * .62, h * .26), (w * .62, h * .1)], fill=(255, 255, 255, 255), width=int(w * .008))
    d.polygon([(w * .62, h * .1), (w * .72, h * .14), (w * .62, h * .19)], fill=c + (255,))
    d.ellipse([w * .14, h * .14, w * .14 + w * .07, h * .14 + w * .07], fill=(255, 236, 180, 255))


def m_wild(d, w, h, c, rnd):  # compass + dice
    cx, cy, r = w * .66, h * .5, w * .19
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(14, 40, 44, 255), outline=c + (255,), width=int(w * .012))
    for a in range(0, 360, 30):
        x, y = math.cos(math.radians(a)), math.sin(math.radians(a))
        d.line([(cx + x * r * .86, cy + y * r * .86), (cx + x * r * .98, cy + y * r * .98)], fill=(255, 255, 255, 220), width=int(w * .005))
    d.polygon([(cx, cy - r * .8), (cx + r * .17, cy), (cx - r * .17, cy)], fill=(251, 113, 133, 255))
    d.polygon([(cx, cy + r * .8), (cx + r * .17, cy), (cx - r * .17, cy)], fill=(240, 244, 255, 255))
    d.ellipse([cx - r * .07, cy - r * .07, cx + r * .07, cy + r * .07], fill=(255, 255, 255, 255))
    x0, y0, s = w * .12, h * .46, w * .17
    d.rounded_rectangle([x0, y0, x0 + s, y0 + s], radius=int(s * .2), fill=(255, 255, 255, 240))
    for px, py in ((.25, .25), (.75, .25), (.5, .5), (.25, .75), (.75, .75)):
        d.ellipse([x0 + s * px - s * .07, y0 + s * py - s * .07, x0 + s * px + s * .07, y0 + s * py + s * .07], fill=(16, 20, 50, 255))


def m_duel(d, w, h, c, rnd):  # two sides, VS
    d.polygon([(0, 0), (w * .55, 0), (w * .45, h), (0, h)], fill=(105, 120, 245, 120))
    d.polygon([(w * .55, 0), (w, 0), (w, h), (w * .45, h)], fill=(231, 93, 135, 120))
    for sx, col in ((.25, (105, 120, 245)), (.75, (251, 113, 133))):
        cx, cy = w * sx, h * .46
        d.ellipse([cx - w * .07, cy - w * .13, cx + w * .07, cy + w * .01], fill=col + (255,))
        d.rounded_rectangle([cx - w * .12, cy + w * .03, cx + w * .12, cy + w * .27], radius=int(w * .06), fill=col + (255,))
    d.polygon(star_poly(w * .5, h * .5, w * .1, w * .055, 5), fill=(255, 220, 90, 255))
    d.text((w * .5, h * .5), 'VS', font=font(int(w * .07)), fill=(30, 20, 60, 255), anchor='mm')


def m_dilemma(d, w, h, c, rnd):  # balance scales
    cx = w * .5
    d.rectangle([cx - w * .008, h * .22, cx + w * .008, h * .78], fill=(255, 255, 255, 240))
    d.rounded_rectangle([cx - w * .12, h * .76, cx + w * .12, h * .82], radius=int(w * .02), fill=(255, 255, 255, 240))
    d.line([(w * .22, h * .3), (w * .78, h * .3)], fill=(255, 255, 255, 240), width=int(w * .01))
    for x, col in ((w * .22, (105, 120, 245)), (w * .78, (251, 113, 133))):
        d.line([(x, h * .3), (x - w * .08, h * .56)], fill=(255, 255, 255, 200), width=int(w * .005))
        d.line([(x, h * .3), (x + w * .08, h * .56)], fill=(255, 255, 255, 200), width=int(w * .005))
        d.pieslice([x - w * .1, h * .46, x + w * .1, h * .7], 0, 180, fill=col + (255,))
    d.ellipse([cx - w * .02, h * .2, cx + w * .02, h * .2 + w * .04], fill=(255, 220, 90, 255))


def make_modes():
    mode_card('daily', (60, 28, 80), (150, 50, 70), AMBER, m_daily, 1)
    mode_card('quick', (14, 22, 80), (40, 40, 140), INDIGO, m_quick, 2)
    mode_card('hard', (50, 10, 30), (130, 30, 50), CORAL, m_hard, 3)
    mode_card('wild', (6, 44, 44), (10, 90, 80), MINT, m_wild, 4)
    mode_card('duel', (30, 14, 80), (110, 40, 120), VIOLET, m_duel, 5)
    mode_card('dilemma', (60, 18, 60), (30, 24, 100), CORAL, m_dilemma, 6)


# ---------------------------------------------------------------- mascot, levels, avatars
def pip():
    S = 3; W = 640 * S
    im = Image.new('RGBA', (W, W), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    cx, cy, R = W * .5, W * .6, W * .3
    # antenna with a chain link and a star
    d.line([(cx, cy - R * .9), (cx, W * .2)], fill=(200, 208, 255, 255), width=int(W * .018))
    for off, rot in ((0, 0), (W * .045, 1)):
        x0, y0 = cx - W * .05 + off * 0, W * .17 + off
        d.rounded_rectangle([cx - W * .045, W * .2 + off * .2, cx + W * .045, W * .3 + off * .2], radius=int(W * .04), outline=(220, 226, 255, 255), width=int(W * .014))
    d.polygon(star_poly(cx, W * .13, W * .075, W * .035, 5), fill=AMBER + (255,))
    # feet
    for sx in (-1, 1):
        d.ellipse([cx + sx * R * .45 - R * .22, cy + R * .86, cx + sx * R * .45 + R * .22, cy + R * 1.1], fill=(70, 80, 200, 255))
    # body with vertical gradient via mask
    body = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    g = vgrad(W, W, (140, 150, 255), (88, 70, 220))
    m = Image.new('L', (W, W), 0); ImageDraw.Draw(m).ellipse([cx - R, cy - R, cx + R, cy + R], fill=255)
    body.paste(g, (0, 0), m); im.alpha_composite(body)
    d = ImageDraw.Draw(im)
    hl = Image.new('RGBA', (W, W), (0, 0, 0, 0)); ImageDraw.Draw(hl).ellipse([cx - R * .72, cy - R * .8, cx - R * .1, cy - R * .38], fill=(255, 255, 255, 70))
    im.alpha_composite(hl); d = ImageDraw.Draw(im)
    # face
    for sx in (-1, 1):
        ex, ey = cx + sx * R * .36, cy - R * .08
        d.ellipse([ex - R * .22, ey - R * .3, ex + R * .22, ey + R * .3], fill=(255, 255, 255, 255))
        d.ellipse([ex - R * .12 + sx * 2, ey - R * .16, ex + R * .12 + sx * 2, ey + R * .2], fill=(20, 22, 60, 255))
        d.ellipse([ex - R * .05 + sx * 2, ey - R * .12, ex + R * .03 + sx * 2, ey - R * .02], fill=(255, 255, 255, 255))
        ch = Image.new('RGBA', (W, W), (0, 0, 0, 0)); ImageDraw.Draw(ch).ellipse([ex - R * .3, ey + R * .38, ex + R * .3, ey + R * .62], fill=(251, 113, 133, 140)); im.alpha_composite(ch); d = ImageDraw.Draw(im)
    d.arc([cx - R * .26, cy + R * .1, cx + R * .26, cy + R * .5], 15, 165, fill=(20, 22, 60, 255), width=int(W * .014))
    im = im.resize((640, 640), Image.LANCZOS); im.save(f'{OUT}/pip.png')


LEVEL_COLORS = [((205, 140, 90), (120, 70, 40)), ((190, 200, 220), (90, 100, 130)), ((90, 220, 190), (20, 110, 110)),
                ((255, 215, 110), (190, 110, 20)), ((196, 160, 255), (90, 50, 190)), ((255, 140, 170), (170, 30, 90)), ((255, 238, 140), (251, 113, 133))]


def shield_mask(W):
    m = Image.new('L', (W, W), 0); d = ImageDraw.Draw(m)
    pts = [(W * .5, W * .04), (W * .9, W * .18), (W * .86, W * .56), (W * .5, W * .96), (W * .14, W * .56), (W * .1, W * .18)]
    d.polygon(pts, fill=255); return m, pts


def level_icon(d, i, cx, cy, u):
    wht = (255, 255, 255, 245)
    if i == 0: d.ellipse([cx - u * .5, cy - u * .5, cx + u * .5, cy + u * .5], fill=wht)
    elif i == 1: d.polygon(star_poly(cx, cy, u * 1.1, u * .3, 4), fill=wht)
    elif i == 2: d.polygon([(cx, cy - u * 1.1), (cx + u * .8, cy), (cx, cy + u * 1.1), (cx - u * .8, cy)], fill=wht)
    elif i == 3: d.polygon([(cx, cy - u * 1.2), (cx + u * .8, cy + u * .1), (cx + u * .45, cy + u * 1.0), (cx - u * .45, cy + u * 1.0), (cx - u * .8, cy + u * .1)], fill=wht)
    elif i == 4:
        d.polygon([(cx - u * 1.1, cy - u * .7), (cx, cy - u * .4), (cx, cy + u * .9), (cx - u * 1.1, cy + u * .6)], fill=wht)
        d.polygon([(cx + u * 1.1, cy - u * .7), (cx, cy - u * .4), (cx, cy + u * .9), (cx + u * 1.1, cy + u * .6)], fill=(255, 255, 255, 200))
    elif i == 5:
        d.polygon([(cx - u * 1.1, cy - u * .5), (cx, cy - u * 1.1), (cx + u * 1.1, cy - u * .5)], fill=wht)
        for k in (-.7, 0, .7): d.rectangle([cx + u * k - u * .16, cy - u * .35, cx + u * k + u * .16, cy + u * .9], fill=wht)
    else: d.polygon([(cx - u * 1.1, cy + u * .7), (cx - u * 1.1, cy - u * .6), (cx - u * .5, cy), (cx, cy - u * .9), (cx + u * .5, cy), (cx + u * 1.1, cy - u * .6), (cx + u * 1.1, cy + u * .7)], fill=wht)


def levels():
    S = 3; W = 320 * S
    for i, (hi, lo) in enumerate(LEVEL_COLORS):
        im = Image.new('RGBA', (W, W), (0, 0, 0, 0))
        mask, pts = shield_mask(W)
        outer = vgrad(W, W, hi, lo); im.paste(outer, (0, 0), mask)
        inner = Image.new('L', (W, W), 0); ImageDraw.Draw(inner).polygon([(W * .5 + (x - W * .5) * .82, W * .5 + (y - W * .5) * .82 + W * .01) for x, y in pts], fill=255)
        im.paste(vgrad(W, W, lo, tuple(int(c * .55) for c in lo)), (0, 0), inner)
        d = ImageDraw.Draw(im); level_icon(d, i, W * .5, W * .46, W * .12)
        d.line(pts + [pts[0]], fill=(255, 255, 255, 120), width=int(W * .012), joint='curve')
        im.resize((320, 320), Image.LANCZOS).save(f'{OUT}/level-{i + 1}.png')


AV = [((251, 113, 133), (190, 40, 100)), ((105, 120, 245), (60, 40, 190)), ((52, 211, 153), (10, 110, 100)), ((251, 191, 36), (220, 100, 20)),
      ((56, 189, 248), (30, 80, 200)), ((167, 139, 250), (110, 50, 200)), ((244, 114, 182), (180, 50, 140)), ((74, 222, 128), (20, 120, 70)),
      ((251, 146, 60), (200, 60, 30)), ((148, 163, 184), (60, 70, 110)), ((45, 212, 191), (20, 90, 140)), ((253, 224, 71), (234, 120, 20))]


def avatar_glyph(d, i, c, u):
    w = (255, 255, 255, 250); cx, cy = c
    if i == 0:  # rocket
        d.ellipse([cx - u * .45, cy - u * 1.15, cx + u * .45, cy + u * .7], fill=w); d.polygon([(cx - u * .45, cy + u * .1), (cx - u * 1.0, cy + u * .9), (cx - u * .3, cy + u * .55)], fill=w); d.polygon([(cx + u * .45, cy + u * .1), (cx + u * 1.0, cy + u * .9), (cx + u * .3, cy + u * .55)], fill=w)
    elif i == 1:  # planet
        d.ellipse([cx - u * .7, cy - u * .7, cx + u * .7, cy + u * .7], fill=w); d.arc([cx - u * 1.2, cy - u * .35, cx + u * 1.2, cy + u * .35], 0, 360, fill=(255, 255, 255, 180), width=int(u * .12))
    elif i == 2: d.polygon(star_poly(cx, cy, u * 1.15, u * .32, 4), fill=w)
    elif i == 3:  # comet
        d.ellipse([cx - u * .1, cy - u * .1, cx + u * .7, cy + u * .7], fill=w); d.polygon([(cx + u * .3, cy + u * .3), (cx - u * 1.0, cy - u * .8), (cx - u * .4, cy - u * .9), (cx + u * .1, cy + u * .1)], fill=(255, 255, 255, 170))
    elif i == 4: d.polygon([(cx - u * 1.1, cy + u * .8), (cx - u * .2, cy - u * .8), (cx + u * .3, cy), (cx + u * .6, cy - u * .4), (cx + u * 1.1, cy + u * .8)], fill=w)
    elif i == 5:  # key
        d.ellipse([cx - u * 1.0, cy - u * .45, cx - u * .1, cy + u * .45], outline=w, width=int(u * .22)); d.rectangle([cx - u * .1, cy - u * .1, cx + u * 1.0, cy + u * .1], fill=w); d.rectangle([cx + u * .6, cy, cx + u * .78, cy + u * .45], fill=w)
    elif i == 6: d.ellipse([cx - u * .85, cy - u * .85, cx + u * .85, cy + u * .85], fill=w); d.ellipse([cx - u * .45, cy - u * 1.0, cx + u * 1.15, cy + u * .6], fill=(0, 0, 0, 0)) if False else None; d.pieslice([cx - u * .3, cy - u * 1.05, cx + u * 1.3, cy + u * .55], 0, 360, fill=AV[6][1] + (255,))
    elif i == 7: d.polygon([(cx + u * .2, cy - u * 1.2), (cx - u * .7, cy + u * .1), (cx - u * .05, cy + u * .1), (cx - u * .25, cy + u * 1.2), (cx + u * .7, cy - u * .15), (cx + u * .05, cy - u * .15)], fill=w)
    elif i == 8:
        for k in range(3): r = u * (1.2 - k * .38); d.arc([cx - r, cy + u * .5 - r, cx + r, cy + u * .5 + r], 200, 340, fill=w, width=int(u * .2))
    elif i == 9: d.polygon([(cx - u * .9, cy + u * .9), (cx - u * .9, cy - u * .1), (cx, cy - u * 1.0), (cx + u * .9, cy - u * .1), (cx + u * .9, cy + u * .9), (cx, cy + u * .3)], fill=w)
    elif i == 10: d.ellipse([cx - u * 1.15, cy - u * .6, cx + u * 1.15, cy + u * .6], fill=w); d.ellipse([cx - u * .4, cy - u * .4, cx + u * .4, cy + u * .4], fill=AV[10][1] + (255,))
    else: d.polygon([(cx - u * 1.0, cy + u * .6), (cx - u * 1.0, cy - u * .6), (cx - u * .45, cy), (cx, cy - u * .9), (cx + u * .45, cy), (cx + u * 1.0, cy - u * .6), (cx + u * 1.0, cy + u * .6)], fill=w)


def avatars():
    S = 3; W = 256 * S
    for i, (hi, lo) in enumerate(AV):
        im = Image.new('RGBA', (W, W), (0, 0, 0, 0))
        m = Image.new('L', (W, W), 0); ImageDraw.Draw(m).ellipse([0, 0, W - 1, W - 1], fill=255)
        im.paste(vgrad(W, W, hi, lo), (0, 0), m)
        gl = radial(W, W, W * .3, W * .25, W * .6, (255, 255, 255), .35, 2); gl.putalpha(Image.composite(gl.getchannel('A'), Image.new('L', (W, W), 0), m)); im.alpha_composite(gl)
        lay = Image.new('RGBA', (W, W), (0, 0, 0, 0)); avatar_glyph(ImageDraw.Draw(lay), i, (W / 2, W / 2), W * .17)
        sh = lay.filter(ImageFilter.GaussianBlur(W * .02)); sh = Image.eval(sh, lambda v: v)
        im.alpha_composite(lay)
        ImageDraw.Draw(im).ellipse([W * .01, W * .01, W * .99, W * .99], outline=(255, 255, 255, 110), width=int(W * .018))
        im.resize((256, 256), Image.LANCZOS).save(f'{OUT}/avatar-{i + 1:02d}.png')


def og():
    base = Image.open(f'{OUT}/hero.jpg').convert('RGBA').resize((1200, 675), Image.LANCZOS).crop((0, 20, 1200, 650))
    ov = Image.new('RGBA', (1200, 630), (0, 0, 0, 0))
    ov.alpha_composite(radial(1200, 630, 360, 330, 520, (8, 11, 30), .85, 1.2))
    base.alpha_composite(ov)
    d = ImageDraw.Draw(base)
    d.text((70, 150), 'Wiki', font=font(150), fill=WHITE + (255,)); wk = d.textlength('Wiki', font=font(150))
    d.text((70 + wk, 150), 'Rush', font=font(150), fill=(174, 183, 255, 255))
    d.text((74, 330), 'Race from one Wikipedia page', font=font(40), fill=(230, 234, 255, 255))
    d.text((74, 380), 'to another. Fastest route wins.', font=font(40), fill=(230, 234, 255, 255))
    d.rounded_rectangle([74, 470, 74 + 330, 470 + 76], radius=38, fill=INDIGO + (255,))
    d.text((74 + 165, 470 + 38), 'PLAY FREE', font=font(38), fill=WHITE + (255,), anchor='mm')
    d.text((430, 508), 'duelio.ink/wikirush', font=font(30), fill=(200, 208, 255, 255), anchor='lm')
    p = Image.open(f'{OUT}/pip.png').resize((340, 340), Image.LANCZOS)
    base.alpha_composite(p, (800, 250))
    base.convert('RGB').save(f'{OUT}/og.png')


if __name__ == '__main__':
    make_heroes()
    make_modes()
    pip(); levels(); avatars(); og()
    print('all art done')
