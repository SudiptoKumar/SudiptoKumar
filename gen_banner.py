import json, html
from PIL import ImageFont

FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"

def text_w(s, size):
    f = ImageFont.truetype(FONT_REG, size)
    b = f.getbbox(s)
    return b[2] - b[0]

PORTRAIT = {
    "dark": json.load(open("/home/claude/build/portrait_dark_runs.json")),
    "light": json.load(open("/home/claude/build/portrait_light_runs.json")),
}

W, H = 1180, 610
CONTENT_X0, CONTENT_X1 = 36, 1144
CONTENT_Y0, CONTENT_Y1 = 84, 576
GAP = 14
LEFT_W = int((CONTENT_X1 - CONTENT_X0) * 0.38)
RIGHT_X = CONTENT_X0 + LEFT_W + GAP
RIGHT_W = CONTENT_X1 - RIGHT_X

SECTIONS = [
    ("PROFILE", [
        ("Subject", "Sudipto Kumar"),
        ("Role", "Full-Stack & Automation Dev"),
        ("Education", "BBA \u2014 Finance & Banking"),
        ("Status", "Building + Automating + Learning"),
    ]),
    ("STACK", [
        ("Lang", "Python \u00b7 TS \u00b7 JS \u00b7 Kotlin"),
        ("Frontend", "React \u00b7 HTML \u00b7 CSS"),
        ("Backend", "Node.js \u00b7 .NET"),
        ("Database", "Postgres \u00b7 MySQL \u00b7 Mongo \u00b7 Firebase"),
        ("Tooling", "Git \u00b7 Linux \u00b7 Bash \u00b7 Postman"),
    ]),
    ("CONTACT", [
        ("Mail", "sudipto.karn@gmail.com"),
        ("LinkedIn", "/in/sudipto-kumar"),
        ("GitHub", "@SudiptoKumar"),
        ("Telegram", "@NewsroomHQ"),
        ("X", "@sudiptokarn"),
        ("Instagram", "@real.sudipto"),
    ]),
]

THEMES = {
    "dark": dict(
        outer="#070B16", panel1="#0A101F", panel2="#0C1426", titlebar="#0B1222",
        border_soft="rgba(255,255,255,0.10)", portrait="#A78BFA", chrome="#22D3EE",
        accent="#10B981", text_primary="#F8FAFC", text_label="#94A3B8",
        text_faint="#475569", text_dim="#64748B", panel_border="rgba(34,211,238,0.35)",
        frame_fill="#0A101F", pill_fill="rgba(167,139,250,0.12)",
    ),
    "light": dict(
        outer="#E2E5F1", panel1="#FFFFFF", panel2="#F4F5FA", titlebar="#F1F2F8",
        border_soft="rgba(15,23,42,0.08)", portrait="#7C3AED", chrome="#0891B2",
        accent="#059669", text_primary="#0F172A", text_label="#475569",
        text_faint="#94A3B8", text_dim="#64748B", panel_border="rgba(8,145,178,0.30)",
        frame_fill="#FFFFFF", pill_fill="rgba(124,58,237,0.08)",
    ),
}


def dotted_leader(x0, x1, y, color):
    if x1 - x0 < 6:
        return ""
    return (f'<line x1="{x0:.1f}" y1="{y}" x2="{x1:.1f}" y2="{y}" '
            f'stroke="{color}" stroke-width="1" stroke-dasharray="1,3" '
            f'stroke-linecap="round" opacity="0.5"/>')


def build_rows(t):
    out = []
    label_x = RIGHT_X + 22
    value_x = CONTENT_X1 - 22
    max_value_w = RIGHT_W - 44 - 130  # reserve ~130px for label column
    y = CONTENT_Y0 + 62
    for si, (header, rows) in enumerate(SECTIONS):
        if si > 0:
            y += 8
        out.append(
            f'<text x="{label_x}" y="{y}" font-size="13" letter-spacing="2" '
            f'fill="{t["text_faint"]}">{header}</text>'
        )
        out.append(dotted_leader(label_x + text_w(header, 13) + 10, value_x, y - 4, t["border_soft"]))
        y += 20
        for label, value in rows:
            lw = text_w(label, 14)
            vw = min(text_w(value, 14), max_value_w)
            leader_x0 = label_x + lw + 10
            leader_x1 = value_x - vw - 10
            out.append(f'<text x="{label_x}" y="{y}" font-size="14" fill="{t["text_label"]}">{html.escape(label)}</text>')
            out.append(dotted_leader(leader_x0, leader_x1, y - 4, t["border_soft"]))
            out.append(
                f'<text x="{value_x}" y="{y}" font-size="14" text-anchor="end" '
                f'textLength="{vw:.1f}" lengthAdjust="spacingAndGlyphs" '
                f'fill="{t["text_primary"]}">{html.escape(value)}</text>'
            )
            y += 23
    return "\n".join(out), y


def build_monogram(t, theme_name):
    data = PORTRAIT[theme_name]
    grid_w, grid_h = data["grid_w"], data["grid_h"]
    pad_top = 20
    pad_bottom = 20
    avail_w = LEFT_W - 32
    avail_h = (CONTENT_Y1 - CONTENT_Y0) - pad_top - pad_bottom
    scale = min(avail_w / grid_w, avail_h / grid_h)
    block_w, block_h = grid_w * scale, grid_h * scale
    tx = CONTENT_X0 + (LEFT_W - block_w) / 2
    ty = CONTENT_Y0 + pad_top + (avail_h - block_h) / 2

    path_d = "".join(f"M{x} {y}h{run}v1h-{run}z" for x, y, run in data["runs"])

    return f'''<g transform="translate({tx:.1f},{ty:.1f}) scale({scale:.4f},{scale:.4f})" fill="{t['portrait']}" shape-rendering="crispEdges">
<g opacity="0">
<animate attributeName="opacity" values="0;1" dur="1.8s" begin="0.15s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".4 0 .2 1"/>
<animate attributeName="opacity" values="1;0.9;1" dur="5s" begin="2s" repeatCount="indefinite"/>
<path d="{path_d}"/>
</g>
</g>'''


def build_svg(theme_name):
    t = THEMES[theme_name]
    rows_svg, last_y = build_rows(t)
    mono_svg = build_monogram(t, theme_name)

    live_x = CONTENT_X1 - 22
    live_y = CONTENT_Y0 + 30
    pill_text = "@SudiptoKumar"
    pill_w = text_w(pill_text, 14) + 34

    title = f"sudipto.karn@gmail.com - % ./profile.sh --live"

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace" role="img" aria-label="Sudipto Kumar \u2014 profile.sh --live">
<defs>
<linearGradient id="accent-{theme_name}" x1="0" y1="0" x2="1" y2="0">
<stop offset="0" stop-color="{t['portrait']}"><animate attributeName="stop-color" values="{t['portrait']};{t['chrome']};{t['accent']};{t['portrait']}" dur="10s" repeatCount="indefinite"/></stop>
<stop offset="0.5" stop-color="{t['chrome']}"><animate attributeName="stop-color" values="{t['chrome']};{t['accent']};{t['portrait']};{t['chrome']}" dur="10s" repeatCount="indefinite"/></stop>
<stop offset="1" stop-color="{t['accent']}"><animate attributeName="stop-color" values="{t['accent']};{t['portrait']};{t['chrome']};{t['accent']}" dur="10s" repeatCount="indefinite"/></stop>
</linearGradient>
<linearGradient id="panelGrad-{theme_name}" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="{t['panel1']}"/><stop offset="1" stop-color="{t['panel2']}"/>
</linearGradient>
<filter id="glow3-{theme_name}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3"/></filter>
<clipPath id="winClip-{theme_name}"><rect x="2" y="2" width="{W-4}" height="{H-4}" rx="18"/></clipPath>
</defs>
<rect x="2" y="2" width="{W-4}" height="{H-4}" rx="18" fill="{t['outer']}"/>
<g clip-path="url(#winClip-{theme_name})">
<rect x="2" y="2" width="{W-4}" height="{H-4}" fill="url(#panelGrad-{theme_name})"/>
<rect x="2" y="2" width="{W-4}" height="46" fill="{t['titlebar']}"/>
<line x1="2" y1="48" x2="{W-2}" y2="48" stroke="{t['border_soft']}"/>
<circle cx="30" cy="25" r="5.5" fill="#ff5f56"/>
<circle cx="50" cy="25" r="5.5" fill="#ffbd2e"/>
<circle cx="70" cy="25" r="5.5" fill="#27c93f"/>
<text x="{W/2}" y="29" text-anchor="middle" font-size="12" fill="{t['text_label']}">{html.escape(title)}</text>

<text x="{CONTENT_X0+2}" y="74" font-size="10" letter-spacing="3" fill="{t['text_faint']}">VISUAL.MAP</text>
<rect x="{CONTENT_X0}" y="{CONTENT_Y0}" width="{LEFT_W}" height="{CONTENT_Y1-CONTENT_Y0}" rx="10" fill="none" stroke="{t['chrome']}" stroke-width="2" opacity="0.45" filter="url(#glow3-{theme_name})"/>
<rect x="{CONTENT_X0}" y="{CONTENT_Y0}" width="{LEFT_W}" height="{CONTENT_Y1-CONTENT_Y0}" rx="10" fill="{t['frame_fill']}" stroke="{t['panel_border']}"/>
{mono_svg}

<text x="{RIGHT_X}" y="74" font-size="10" letter-spacing="3" fill="{t['text_faint']}">SYSTEM.INFO</text>
<rect x="{RIGHT_X}" y="{CONTENT_Y0}" width="{RIGHT_W}" height="{CONTENT_Y1-CONTENT_Y0}" rx="10" fill="none" stroke="{t['chrome']}" stroke-width="2" opacity="0.45" filter="url(#glow3-{theme_name})"/>
<rect x="{RIGHT_X}" y="{CONTENT_Y0}" width="{RIGHT_W}" height="{CONTENT_Y1-CONTENT_Y0}" rx="10" fill="{t['frame_fill']}" stroke="{t['panel_border']}"/>

<rect x="{RIGHT_X+18}" y="{CONTENT_Y0+16}" width="{pill_w:.1f}" height="24" rx="12" fill="{t['pill_fill']}" stroke="{t['chrome']}" stroke-width="1" opacity="0.8"/>
<text x="{RIGHT_X+18+pill_w/2:.1f}" y="{CONTENT_Y0+32}" text-anchor="middle" font-size="14" fill="{t['portrait']}">{pill_text}</text>

<circle cx="{live_x-38}" cy="{live_y}" r="4" fill="#ef4444"><animate attributeName="opacity" values="1;0.25;1" dur="1.4s" repeatCount="indefinite"/></circle>
<text x="{live_x-28}" y="{live_y+4}" font-size="12" letter-spacing="2" fill="{t['text_label']}">LIVE</text>

{rows_svg}

<rect x="{CONTENT_X0}" y="{CONTENT_Y1+18}" width="{CONTENT_X1-CONTENT_X0}" height="3" rx="1.5" fill="url(#accent-{theme_name})"/>
</g>
</svg>'''
    return svg


if __name__ == "__main__":
    for theme in ("dark", "light"):
        svg = build_svg(theme)
        path = f"/home/claude/build/{theme}.svg"
        with open(path, "w") as f:
            f.write(svg)
        print(theme, len(svg), "bytes")
