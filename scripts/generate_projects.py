#!/usr/bin/env python3
"""Builder Base: an animated, game-style Projects panel (projects.svg / projects-light.svg).

Every repository is a plot. A builder hammers its building through a looping
upgrade: scaffolding, walls rising, roof dropping, sparkle, next upgrade.
Style comes from the main language (Python = wizard tower, TypeScript = castle,
JavaScript/other = hall); size and level come from repo size and stars.

Usage: python3 scripts/generate_projects.py merged.json out
"""
import html, json, math, os, re, sys

T = {
    "dark": dict(BG="#09110F", GROUND="#132A1F", DIRT="#1D3B2B", EDGE="rgba(230,180,80,.38)",
                 WOOD="#6B4A2B", WOOD_D="#3E2A18", WOOD_L="#9A7040", GOLD="#E6B450",
                 LIME="#B8F27C", TEXT="#FFF3D6", MUTED="#D6C6A0", STAR="#FFF7D6"),
    "light": dict(BG="#F3F7F4", GROUND="#CDE7C3", DIRT="#B4D3A4", EDGE="rgba(154,106,11,.45)",
                  WOOD="#8F6532", WOOD_D="#5B3D1C", WOOD_L="#C79A5B", GOLD="#F2C14E",
                  LIME="#8FD14F", TEXT="#FFF6E0", MUTED="#F3E3BE", STAR="#FFF7D6"),
}
FONT = "ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace"
W, CW, CH, GAP, HEAD, DUR = 1184, 376, 216, 10, 88, 9.0
LANGS = {"Python": ("tower", "#4B8BBE", "#FFD43B"),
         "TypeScript": ("keep", "#3178C6", "#F7B267"),
         "JavaScript": ("hall", "#E9CF3A", "#8A4B2A")}
OTHER = ("hall", "#3FB68B", "#1F6F52")

esc = lambda s: html.escape(str(s), quote=True)


def cut(s, n):
    s = re.sub(r"[\U00010000-\U0010ffff\ufe0f]", "", str(s or ""))
    s = " ".join(s.split())
    return s if len(s) <= n else s[:n - 1].rstrip() + "…"


def shade(h, f):
    return "#%02x%02x%02x" % tuple(int(int(h[i:i + 2], 16) * f) for i in (1, 3, 5))


def an(vals, keys, begin, dur=DUR, attr="opacity", kind=None):
    tag = f'attributeName="transform" type="{kind}"' if kind else f'attributeName="{attr}"'
    el = "animateTransform" if kind else "animate"
    return (f'<{el} {tag} values="{vals}" keyTimes="{keys}" dur="{dur}s" '
            f'begin="{begin:.2f}s" repeatCount="indefinite"/>')


# ---------- buildings: origin = centre of the base, y grows upward (negative) ----------
def _walls(w, h, wall):
    return (f'<rect x="{-w/2}" y="{-h}" width="{w}" height="{h}" fill="{wall}"/>'
            f'<rect x="{w*.14}" y="{-h}" width="{w*.36}" height="{h}" fill="{shade(wall, .78)}"/>')


def _window(x, y, size, c, ph):
    return (f'<rect x="{x}" y="{y}" width="{size}" height="{size}" fill="#FFE9A8" stroke="{c["WOOD_D"]}" '
            f'stroke-width="2">{an(".6;1;.75;1", "0;.3;.6;1", ph, 2.3)}</rect>')


def tower(w, h, wall, roof, c, ph):
    dk = shade(wall, .78)
    body = _walls(w, h, wall)
    body += "".join(f'<path d="M{-w/2} {-y}H{w/2}" stroke="{dk}" stroke-width="1.2" opacity=".55"/>'
                    for y in range(12, int(h), 12))
    body += f'<path d="M-7 0V-12A7 7 0 0 1 7 -12V0Z" fill="{c["WOOD_D"]}"/>' + _window(-5, -h * .68, 10, c, ph)
    ch = int(w * .62)
    top = (f'<path d="M{-w/2-7} {-h}L0 {-h-ch}L{w/2+7} {-h}Z" fill="{roof}"/>'
           f'<path d="M0 {-h-ch}L{w/2+7} {-h}L0 {-h}Z" fill="{shade(roof, .8)}"/>'
           f'<circle cy="{-h-ch-3}" r="3.2" fill="{c["STAR"]}">{an("1;.3;1", "0;.5;1", ph, 1.6)}</circle>')
    return body, top


def keep(w, h, wall, flag, c, ph):
    tn, t = shade(wall, .9), c["WOOD_D"]
    body = _walls(w, h, wall)
    for sx in (-1, 1):
        tx = sx * w / 2 - 7
        body += f'<rect x="{tx}" y="{-h-14}" width="14" height="{h+14}" fill="{tn}"/>'
        body += "".join(f'<rect x="{tx+k}" y="{-h-20}" width="4" height="6" fill="{tn}"/>' for k in (0, 5, 10))
    body += "".join(f'<rect x="{-w/2+8+k}" y="{-h-7}" width="6" height="7" fill="{wall}"/>'
                    for k in range(0, int(w) - 16, 12))
    body += (f'<path d="M-8 0V-14A8 8 0 0 1 8 -14V0Z" fill="{t}"/>'
             f'<path d="M-4 -1V-18M0 -1V-20M4 -1V-18" stroke="{c["WOOD_L"]}"/>'
             f'<rect x="{-w/4-1.5}" y="{-h*.62}" width="3" height="10" fill="#FFE9A8">{an(".6;1;.75;1", "0;.3;.6;1", ph, 2.3)}</rect>'
             f'<rect x="{w/4-1.5}" y="{-h*.62}" width="3" height="10" fill="#FFE9A8">{an("1;.65;1", "0;.5;1", ph, 1.9)}</rect>')
    top = (f'<path d="M0 {-h-7}V{-h-38}" stroke="{c["WOOD_L"]}" stroke-width="2"/>'
           f'<g transform="translate(0 {-h-38})"><g>{an("1 1;.7 1;1 1", "0;.5;1", ph, 1.4, kind="scale")}'
           f'<path d="M0 0L18 5L0 10Z" fill="{flag}"/></g></g>')
    return body, top


def hall(w, h, wall, roof, c, ph):
    t = c["WOOD_D"]
    body = (_walls(w, h, wall) + f'<path d="M-6 0V-13A6 6 0 0 1 6 -13V0Z" fill="{t}"/>'
            + _window(-w / 2 + 8, -h * .66, 10, c, ph) + _window(w / 2 - 18, -h * .66, 10, c, ph))
    rh, cxh = int(w * .5), w * .18 + 4.5
    y0 = -h - rh * .85
    smoke = "".join(
        f'<circle cx="{cxh}" cy="{y0-4}" r="3" fill="#fff" opacity="0">'
        f'{an(f"{y0-4};{y0-20}", "0;1", ph - k, 2.2, "cy")}{an(".55;0", "0;1", ph - k, 2.2)}</circle>'
        for k in (0, 1.1))
    top = (f'<rect x="{cxh-4.5}" y="{y0}" width="9" height="{rh*.5}" fill="{shade(roof, .7)}"/>'
           f'<path d="M{-w/2-8} {-h}L0 {-h-rh}L{w/2+8} {-h}Z" fill="{roof}"/>'
           f'<path d="M0 {-h-rh}L{w/2+8} {-h}L0 {-h}Z" fill="{shade(roof, .8)}"/>' + smoke)
    return body, top


def scaffold(w, h, c):
    x = w / 2 + 10
    planks = "".join(f'<path d="M{-x-6} {-y}H{x+6}"/>' for y in (h * .34, h * .68, h + 12))
    return (f'<g stroke="{c["WOOD_L"]}" stroke-width="2.5" stroke-linecap="round" fill="none">'
            f'<path d="M{-x} 0V{-h-12}M{x} 0V{-h-12}"/>{planks}'
            f'<path d="M{-x} 0L{x} {-h*.34}M{-x} {-h*.34}L{x} {-h*.68}" stroke-width="1.6" opacity=".8"/></g>')


# ---------- characters and props ----------
def builder(x, y, ph, c):
    sparks = "".join(
        f'<circle cx="{dx}" cy="{dy}" r="1.9" fill="{c["GOLD"]}" opacity="0">'
        f'{an("0;0;1;0;0", "0;.46;.5;.7;1", ph, .6)}</circle>' for dx, dy in ((0, 0), (5, -6), (4, 5), (-3, -7)))
    return (f'<g transform="translate({x:.0f} {y})"><g>{an("0 0;0 -1.6;0 0", "0;.5;1", ph, .6, kind="translate")}'
            '<rect x="-5" y="-9" width="4" height="9" fill="#4B3A2A"/><rect x="1" y="-9" width="4" height="9" fill="#4B3A2A"/>'
            '<rect x="-6.5" y="-23" width="13" height="15" rx="3" fill="#D9822B"/>'
            '<rect x="-6.5" y="-13" width="13" height="2.5" fill="#6B3E12"/>'
            '<circle cy="-30" r="7" fill="#F2C08A"/><circle cx="2.5" cy="-30" r=".9" fill="#2A1A0E"/>'
            '<circle cx="-1" cy="-30" r=".9" fill="#2A1A0E"/>'
            '<path d="M-8 -31A8 8 0 0 1 8 -31Z" fill="#F5C542"/><rect x="-9" y="-32" width="18" height="3" rx="1.5" fill="#D9A521"/>'
            f'<g transform="translate(5 -20)"><g>{an("-55;35;-55", "0;.5;1", ph, .6, kind="rotate")}'
            '<path d="M0 0V-10" stroke="#F2C08A" stroke-width="3" stroke-linecap="round"/>'
            f'<path d="M0 -8V-21" stroke="{c["WOOD_L"]}" stroke-width="2.6"/>'
            '<rect x="-6" y="-26" width="12" height="7" rx="1.5" fill="#B3BEB8"/></g></g></g>'
            f'<g transform="translate(22 -38)">{sparks}</g></g>')


def hut(x, y, c, ph):
    return (f'<g transform="translate({x} {y})">'
            f'<rect x="-18" y="-24" width="36" height="24" fill="{c["WOOD"]}"/>'
            f'<path d="M-18 -16H18M-18 -8H18" stroke="{c["WOOD_D"]}" opacity=".5"/>'
            '<path d="M-24 -24L0 -42L24 -24Z" fill="#A5452E"/><path d="M0 -42L24 -24H0Z" fill="#8A3624"/>'
            f'<path d="M-6 0V-13A6 6 0 0 1 6 -13V0Z" fill="{c["WOOD_D"]}"/>'
            f'<circle cx="13" cy="-15" r="2.6" fill="{c["GOLD"]}">{an(".5;1;.7;1", "0;.3;.6;1", ph, 1.9)}</circle>'
            f'<rect x="58" y="-11" width="12" height="11" fill="{c["WOOD_L"]}" stroke="{c["WOOD_D"]}"/>'
            f'<rect x="61" y="-21" width="10" height="10" fill="{c["WOOD"]}" stroke="{c["WOOD_D"]}"/></g>')


# ---------- one repository plot ----------
def plot(p, x, y, i, c):
    langs = p.get("languages") or {}
    top = max(langs, key=langs.get) if langs else ""
    kind, wall, acc = LANGS.get(top, OTHER)
    stars = int(p.get("stars") or 0)
    lvl = min(6, 1 + int(math.log2(sum(langs.values()) / 3000 + 1)) + min(2, stars))
    w = 62 + 4 * lvl
    h = {"tower": 36 + 3 * lvl, "keep": 36 + 4 * lvl, "hall": 38 + 3 * lvl}[kind]
    ph = -((i * 1.37) % DUR)
    cx, by, PW = 236, 138, 300
    body, roof = {"tower": tower, "keep": keep, "hall": hall}[kind](w, h, wall, acc, c, ph)
    tall = h + (int(w * .62) if kind == "tower" else 44 if kind == "keep" else int(w * .5)) + 6
    spark = "".join(
        f'<circle cx="{sx}" cy="{sy}" r="0" fill="{c["GOLD"]}">{an("0;0;4;0;0", ".0;.66;.7;.78;1", ph, attr="r")}</circle>'
        for sx, sy in ((-w / 2 - 6, -h), (w / 2 + 6, -h), (0, -tall), (w / 4, -tall * .8)))
    grow = an("1 .04;1 .04;1 .3;1 .52;1 .74;1 .9;1 1;1 1", "0;.05;.15;.27;.39;.5;.6;1", ph, kind="scale")
    name, desc = cut(p.get("name"), 24), cut(p.get("description") or "Blueprint in progress", 44)
    href = "https://github.com/" + esc(p.get("repo", ""))
    return "".join([
        f'<a href="{href}" target="_blank"><title>{esc(name)}</title><g transform="translate({x} {y})">',
        f'<rect width="{CW}" height="210" rx="16" fill="{c["GROUND"]}" stroke="{c["EDGE"]}"/>',
        f'<path d="M9 23V9H23M353 9H367V23" stroke="{c["EDGE"]}" stroke-width="2" fill="none"/>',
        f'<ellipse cx="{cx}" cy="{by+2}" rx="{w/2+38}" ry="14" fill="{c["DIRT"]}"/>',
        hut(62, by, c, ph), builder(cx - w / 2 - 22, by, ph, c),
        f'<g transform="translate({cx} {by})"><g>{an("0;1;1;0", "0;.06;.94;1", ph)}',
        f'<g>{grow}{body}</g>',
        f'<g>{an("1;1;0;0;1", "0;.62;.72;.99;1", ph)}{scaffold(w, h, c)}</g>',
        f'<g opacity="0">{an("0;0;1;1", "0;.6;.68;1", ph)}{an("0 -40;0 -40;0 0;0 0", "0;.6;.68;1", ph, kind="translate")}{roof}</g>',
        f'{spark}</g></g>',
        f'<rect x="12" y="150" width="352" height="52" rx="9" fill="{c["WOOD"]}" stroke="{c["WOOD_D"]}" stroke-width="2"/>',
        f'<rect x="16" y="153" width="344" height="2" rx="1" fill="{c["WOOD_L"]}" opacity=".6"/>',
        f'<text x="22" y="170" font-size="15" font-weight="700" fill="{c["TEXT"]}">{esc(name)}</text>',
        f'<text x="22" y="184" font-size="10.5" fill="{c["MUTED"]}">{esc(desc)}</text>',
        f'<rect x="22" y="190" width="{PW}" height="5" rx="2.5" fill="{c["WOOD_D"]}"/>',
        f'<rect x="22" y="190" width="{PW}" height="5" rx="2.5" fill="{c["LIME"]}">'
        f'{an(f"0;0;{PW};{PW};0", "0;.05;.6;.94;1", ph, attr="width")}</rect>',
        f'<text x="322" y="170" text-anchor="end" font-size="12" fill="{c["GOLD"]}">&#9733; {stars}</text>',
        f'<g transform="translate(346 172)"><path d="M0-13L11-9V4Q11 11 0 15Q-11 11-11 4V-9Z" fill="{c["GOLD"]}" '
        f'stroke="{c["WOOD_D"]}" stroke-width="2"/><text y="4" text-anchor="middle" font-size="11" font-weight="700" '
        f'fill="{c["WOOD_D"]}">{lvl}</text></g>',
        '</g></a>'])


# ---------- HUD + full scene ----------
def header(projects, c):
    n = len(projects)
    stars = sum(int(p.get("stars") or 0) for p in projects)
    nl = len({l for p in projects for l in (p.get("languages") or {})})
    hat = (f'<path d="M-8 3A8 8 0 0 1 8 3Z" fill="#F5C542"/><rect x="-9" y="2" width="18" height="3" rx="1.5" fill="#D9A521"/>')
    chips = [(hat, f"Builders {n}/{n}", 150),
             (f'<text y="5" text-anchor="middle" font-size="15" fill="{c["GOLD"]}">&#9733;</text>', f"{stars} stars", 112),
             (f'<text y="4" text-anchor="middle" font-size="12" font-weight="700" fill="{c["GOLD"]}">&lt;/&gt;</text>',
              f"{nl} languages", 132)]
    out = [f'<rect x="2" y="10" width="520" height="56" rx="12" fill="{c["WOOD"]}" stroke="{c["GOLD"]}" stroke-width="2"/>',
           f'<rect x="8" y="14" width="508" height="2" rx="1" fill="{c["WOOD_L"]}" opacity=".7"/>',
           f'<text x="22" y="37" font-size="21" font-weight="700" fill="{c["GOLD"]}">Sudipto\'s Builder Base</text>',
           f'<text x="22" y="55" font-size="11" fill="{c["MUTED"]}">Every repo is a building. Every commit keeps a builder busy.</text>']
    x = W - 2 - sum(w for _, _, w in chips) - 8 * (len(chips) - 1)
    for icon, label, cw in chips:
        out.append(f'<rect x="{x}" y="20" width="{cw}" height="36" rx="10" fill="{c["WOOD"]}" stroke="{c["GOLD"]}" stroke-width="1.5"/>'
                   f'<g transform="translate({x+18} 38)">{icon}</g>'
                   f'<text x="{x+36}" y="42" font-size="12.5" font-weight="700" fill="{c["TEXT"]}">{label}</text>')
        x += cw + 8
    out += [f'<circle cx="{560 + k * 22}" cy="{16 + (k * 37) % 44}" r="1.3" fill="{c["GOLD"]}" opacity=".3">'
            f'{an(".15;.9;.15", "0;.5;1", -k * .7, 3)}</circle>' for k in range(9)]
    return "".join(out)


def build(projects, theme):
    c = T[theme]
    rows = max(1, math.ceil(len(projects) / 3))
    H = HEAD + rows * (CH + GAP) + 4
    s = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" '
         f'font-family="{FONT}" role="img" aria-label="Builder Base: my repositories under construction">',
         f'<rect width="{W}" height="{H}" fill="{c["BG"]}"/>', header(projects, c)]
    for i, p in enumerate(projects):
        s.append(plot(p, 2 + (i % 3) * (CW + 26), HEAD + (i // 3) * (CH + GAP), i, c))
    return "".join(s) + "</svg>"


if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else "merged.json"
    outdir = sys.argv[2] if len(sys.argv) > 2 else "."
    with open(src, encoding="utf-8") as f:
        projects = json.load(f)
    for theme, fname in (("dark", "projects.svg"), ("light", "projects-light.svg")):
        svg = build(projects, theme)
        path = os.path.join(outdir, fname)
        with open(path, "w", encoding="utf-8") as f:
            f.write(svg)
        print(f"wrote {path}: {theme}, {len(projects)} builders, {len(svg)//1024}KB")
