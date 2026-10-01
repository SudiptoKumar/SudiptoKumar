import json, math, random, html
from pathlib import Path
from PIL import Image, ImageFont

ROOT = Path(__file__).parent
FONT_REG = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'
FONT_BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf'
W,H = 1180,610
CONTENT_X0, CONTENT_Y0 = 36,84
CONTENT_X1, CONTENT_Y1 = 1144,576
GAP=14
LEFT_W=int((CONTENT_X1-CONTENT_X0)*0.38)
RIGHT_X=CONTENT_X0+LEFT_W+GAP
RIGHT_W=CONTENT_X1-RIGHT_X
PORTRAIT_BOX=(CONTENT_X0, CONTENT_Y0, LEFT_W, CONTENT_Y1-CONTENT_Y0)

SECTIONS = [
    ('PROFILE',[('Subject','Sudipto Kumar'),('Role','Full-Stack & Automation Dev'),('Education','BBA - Finance & Banking'),('Status','Building + Automating + Learning')]),
    ('STACK',[('Lang','Python · TS · JS · Kotlin'),('Frontend','React · HTML · CSS'),('Backend','Node.js · .NET'),('Database','Postgres · MySQL · Mongo · Firebase'),('Tooling','Git · Linux · Bash · Postman')]),
    ('CONTACT',[('Mail','sudipto.karn@gmail.com'),('LinkedIn','/in/sudipto-kumar'),('GitHub','@SudiptoKumar'),('Telegram','@NewsroomHQ'),('X','@sudiptokarn'),('Instagram','@real.sudipto')]),
]

THEMES={
'dark':dict(outer='#070B16',panel1='#0A101F',panel2='#0C1426',titlebar='#0B1222',border='#26334C',portrait='#A78BFA',chrome='#22D3EE',accent='#10B981',text='#F8FAFC',label='#94A3B8',faint='#475569',panelborder='#22D3EE',frame='#0A101F',pill='#1A1730'),
'light':dict(outer='#E2E5F1',panel1='#FFFFFF',panel2='#F4F5FA',titlebar='#F1F2F8',border='#CBD5E1',portrait='#7C3AED',chrome='#0891B2',accent='#059669',text='#0F172A',label='#475569',faint='#64748B',panelborder='#0891B2',frame='#FFFFFF',pill='#F3E8FF'),
}

def text_w(s,size,bold=False):
    f=ImageFont.truetype(FONT_BOLD if bold else FONT_REG,size)
    b=f.getbbox(s); return b[2]-b[0]

def load_runs(theme):
    d=json.load(open(ROOT/f'portrait_{theme}_runs.json'))
    return d['grid_w'],d['grid_h'],d['runs']

def portrait_points(theme):
    gw,gh,runs=load_runs(theme)
    pts=[]
    for x,y,l in runs:
        for i in range(l): pts.append((x+i,y))
    # map into portrait frame; same geometry as existing banner
    pad_top=20; pad_bottom=20; avail_w=LEFT_W-32; avail_h=(CONTENT_Y1-CONTENT_Y0)-pad_top-pad_bottom
    scale=min(avail_w/gw,avail_h/gh)
    bw,bh=gw*scale,gh*scale
    tx=CONTENT_X0+(LEFT_W-bw)/2
    ty=CONTENT_Y0+pad_top+(avail_h-bh)/2
    return [(tx+x*scale, ty+y*scale) for x,y in pts]

def band_paths(theme, n_bands=94):
    gw,gh,runs=load_runs(theme)
    bands=[[] for _ in range(n_bands)]
    for x,y,l in runs:
        bi=min(n_bands-1, int(y/gh*n_bands))
        bands[bi].append((x,y,l))
    pad_top=20; pad_bottom=20; avail_w=LEFT_W-32; avail_h=(CONTENT_Y1-CONTENT_Y0)-pad_top-pad_bottom
    scale=min(avail_w/gw,avail_h/gh); bw,bh=gw*scale,gh*scale
    tx=CONTENT_X0+(LEFT_W-bw)/2; ty=CONTENT_Y0+pad_top+(avail_h-bh)/2
    out=[]
    for arr in bands:
        d=''.join(f'M{tx+x*scale:.2f} {ty+y*scale:.2f}h{l*scale:.2f}v{max(1,scale):.2f}h{-l*scale:.2f}z' for x,y,l in arr)
        out.append(d)
    return out

def sample_points(pts,n,seed):
    if len(pts)==n: return pts
    rnd=random.Random(seed)
    # deterministic even-ish sample then shuffled assignment
    idx=[int(i*len(pts)/n) for i in range(n)]
    sel=[pts[min(len(pts)-1,i)] for i in idx]
    rnd.shuffle(sel)
    return sel

def logo_mask(text, size=150):
    # Custom personal-tech wordmarks: SK, </>, >_. Rasterized to derive a dot cloud.
    img=Image.new('L',(700,300),0)
    f=ImageFont.truetype(FONT_BOLD, size)
    # center text
    bbox=f.getbbox(text); tw,th=bbox[2]-bbox[0],bbox[3]-bbox[1]
    x=(700-tw)//2-bbox[0]; y=(300-th)//2-bbox[1]
    from PIL import ImageDraw
    ImageDraw.Draw(img).text((x,y),text,font=f,fill=255,stroke_width=1)
    pts=[]
    pix=img.load()
    for yy in range(0,300,2):
        for xx in range(0,700,2):
            if pix[xx,yy]>90: pts.append((xx,yy))
    return pts

def map_logo_points(text, n, seed, theme):
    pts=logo_mask(text, 180 if len(text)==2 else 145)
    rnd=random.Random(seed)
    rnd.shuffle(pts)
    if len(pts)<n:
        pts=(pts*((n+len(pts)-1)//len(pts)))[:n]
        rnd.shuffle(pts)
    else:
        pts=pts[:n]
    # fit inside portrait frame with organic offsets
    xs=[p[0] for p in pts]; ys=[p[1] for p in pts]
    minx,maxx,miny,maxy=min(xs),max(xs),min(ys),max(ys)
    boxx,boxy,boxw,boxh=PORTRAIT_BOX
    # logo is centered in portrait frame, not full frame
    target_w=boxw*0.62; target_h=boxh*0.52
    sx=target_w/max(1,maxx-minx); sy=target_h/max(1,maxy-miny); s=min(sx,sy)
    ox=boxx+(boxw-(maxx-minx)*s)/2-minx*s
    oy=boxy+(boxh-(maxy-miny)*s)/2-miny*s
    return [(ox+x*s,oy+y*s) for x,y in pts]

def escape_rows(t):
    def dotted(x0,x1,y):
        return f'<line x1="{x0:.1f}" y1="{y}" x2="{x1:.1f}" y2="{y}" stroke="{t["border"]}" stroke-width="1" stroke-dasharray="1,3" stroke-linecap="round" opacity="0.5"/>' if x1-x0>6 else ''
    out=[]; label_x=RIGHT_X+22; value_x=CONTENT_X1-22; y=CONTENT_Y0+62
    for si,(header,rows) in enumerate(SECTIONS):
        if si: y+=8
        out.append(f'<text x="{label_x}" y="{y}" font-size="13" letter-spacing="2" fill="{t["faint"]}">{header}</text>')
        y+=20
        for lab,val in rows:
            lw=text_w(lab,14); vw=min(text_w(val,14),RIGHT_W-44-130)
            out.append(f'<text x="{label_x}" y="{y}" font-size="14" fill="{t["label"]}">{html.escape(lab)}</text>')
            out.append(dotted(label_x+lw+10,value_x-vw-10,y-4))
            out.append(f'<text x="{value_x}" y="{y}" text-anchor="end" font-size="14" textLength="{vw:.1f}" lengthAdjust="spacingAndGlyphs" fill="{t["text"]}">{html.escape(val)}</text>')
            y+=23
    return '\n'.join(out)

# Timeline fractions for 14.2s loop: portrait 3s, 4 transitions of 1.3s, 3 logos of 2s.
KT=[0,3/14.2,4.3/14.2,6.3/14.2,7.6/14.2,9.6/14.2,10.9/14.2,12.9/14.2,1]
KTSTR=';'.join(f'{x:.6f}' for x in KT)

def anim_path(cx,cy, vals, begin='3.2s'):
    v=';'.join(f'{x:.2f}' for x in vals)
    return f'<animate attributeName="{cx}" values="{v}" keyTimes="{KTSTR}" dur="14.2s" begin="{begin}" repeatCount="indefinite" calcMode="linear"/>'

def dot_travellers(theme, n=900):
    portrait=sample_points(portrait_points(theme),n,11)
    logos=[map_logo_points('SK',n,21,theme),map_logo_points('</>',n,22,theme),map_logo_points('>_',n,23,theme)]
    # Slight deterministic noise around logo positions to avoid quantized/grid feel
    rnd=random.Random(99)
    for arr in logos:
        for i,(x,y) in enumerate(arr):
            arr[i]=(x+rnd.gauss(0,1.7),y+rnd.gauss(0,1.7))
    out=[]
    # each dot positions: portrait at 0, logo1 after transition, logo1 hold, logo2, etc, portrait at end
    for i in range(n):
        seq=[portrait[i],logos[0][i],logos[0][i],logos[1][i],logos[1][i],logos[2][i],logos[2][i],portrait[i],portrait[i]]
        cx=seq[0][0]; cy=seq[0][1]
        xvals=';'.join(f'{p[0]:.2f}' for p in seq)
        yvals=';'.join(f'{p[1]:.2f}' for p in seq)
        points=[f'<circle cx="{cx:.2f}" cy="{cy:.2f}" r="1.55">',
                f'<animate attributeName="cx" values="{xvals}" keyTimes="{KTSTR}" dur="14.2s" begin="3.2s" repeatCount="indefinite" calcMode="linear"/>',
                f'<animate attributeName="cy" values="{yvals}" keyTimes="{KTSTR}" dur="14.2s" begin="3.2s" repeatCount="indefinite" calcMode="linear"/>',
                '<animate attributeName="opacity" values="0;0;1;1;1;1;1;1;0" keyTimes="'+KTSTR+'" dur="14.2s" begin="3.2s" repeatCount="indefinite" calcMode="spline" keySplines=".4 0 .2 1;.4 0 .2 1;.4 0 .2 1;.4 0 .2 1;.4 0 .2 1;.4 0 .2 1;.4 0 .2 1;.4 0 .2 1"/>',
                '</circle>']
        out.append(''.join(points))
    return '\n'.join(out)

def intro_portrait(theme):
    gw,gh,runs=load_runs(theme)
    rnd=random.Random(123 if theme=='dark' else 124)
    groups=[[] for _ in range(60)]
    for r in runs: groups[rnd.randrange(60)].append(r)
    pad_top=20; pad_bottom=20; avail_w=LEFT_W-32; avail_h=(CONTENT_Y1-CONTENT_Y0)-pad_top-pad_bottom
    scale=min(avail_w/gw,avail_h/gh); bw,bh=gw*scale,gh*scale; tx=CONTENT_X0+(LEFT_W-bw)/2; ty=CONTENT_Y0+pad_top+(avail_h-bh)/2
    out=[]
    for gi,arr in enumerate(groups):
        d=''.join(f'M{tx+x*scale:.2f} {ty+y*scale:.2f}h{l*scale:.2f}v{max(1,scale):.2f}h{-l*scale:.2f}z' for x,y,l in arr)
        # scatter-ish stagger with interleaved groups, never spatial sequence
        start=0.05+(gi%15)*0.11
        dur=1.55+(gi%7)*0.06
        end=min(2.45,start+dur)
        out.append(f'<path d="{d}" opacity="0"><animate attributeName="opacity" values="0;1" keyTimes="0;1" dur="2.0s" begin="{start:.2f}s" fill="freeze" calcMode="spline" keySplines=".4 0 .2 1"/></path>')
    return '\n'.join(out)

def main_portrait(theme):
    bands=band_paths(theme,94)
    out=[]
    # first-logo centroid used as drift target; center of SK logo cloud relative to portrait center
    logo=map_logo_points('SK',500,21,theme); cx=sum(x for x,y in logo)/len(logo); cy=sum(y for x,y in logo)/len(logo)
    pcx=CONTENT_X0+LEFT_W/2; drift=cx-pcx
    for i,d in enumerate(bands):
        # signed subtle variation; cap around 42% of path toward centroid
        frac=0.22+0.20*((i*37)%100)/100
        dx=drift*frac
        delay=(i%13)*0.02
        # visible portrait -> fades during first transition; returns during final transition
        out.append(f'<path d="{d}" fill="currentColor" opacity="1" transform="translate(0,0)" style="vector-effect:non-scaling-stroke">'
                   f'<animateTransform attributeName="transform" type="translate" values="0 0;{dx:.2f} 0;{dx:.2f} 0;0 0" keyTimes="0;0.3028;0.9085;1" dur="14.2s" begin="3.2s" repeatCount="indefinite" calcMode="spline" keySplines=".35 0 .2 1;.4 0 .2 1;.35 0 .2 1"/>'
                   f'<animate attributeName="opacity" values="1;0;0;1" keyTimes="0;0.3028;0.9085;1" dur="14.2s" begin="3.2s" repeatCount="indefinite" calcMode="spline" keySplines=".4 0 .2 1;.4 0 .2 1;.4 0 .2 1"/>'
                   f'</path>')
    return '\n'.join(out)

def build(theme):
    t=THEMES[theme]
    rows=escape_rows(t)
    intro=intro_portrait(theme)
    portrait=main_portrait(theme)
    travellers=dot_travellers(theme)
    title='sudipto.karn@gmail.com - % ./profile.sh --live'
    pill='@SudiptoKumar'; pill_w=text_w(pill,14)+34
    live_x=CONTENT_X1-22; live_y=CONTENT_Y0+30
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace" role="img" aria-label="Sudipto Kumar — animated profile.sh --live">
<defs>
<linearGradient id="accent" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{t['portrait']}"/><stop offset=".5" stop-color="{t['chrome']}"/><stop offset="1" stop-color="{t['accent']}"/></linearGradient>
<linearGradient id="panel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{t['panel1']}"/><stop offset="1" stop-color="{t['panel2']}"/></linearGradient>
<filter id="glow"><feGaussianBlur stdDeviation="3"/></filter>
<clipPath id="clip"><rect x="2" y="2" width="{W-4}" height="{H-4}" rx="18"/></clipPath>
</defs>
<rect x="2" y="2" width="{W-4}" height="{H-4}" rx="18" fill="{t['outer']}"/>
<g clip-path="url(#clip)">
<rect x="2" y="2" width="{W-4}" height="{H-4}" fill="url(#panel)"/>
<rect x="2" y="2" width="{W-4}" height="46" fill="{t['titlebar']}"/><line x1="2" y1="48" x2="{W-2}" y2="48" stroke="{t['border']}"/>
<circle cx="30" cy="25" r="5.5" fill="#ff5f56"/><circle cx="50" cy="25" r="5.5" fill="#ffbd2e"/><circle cx="70" cy="25" r="5.5" fill="#27c93f"/>
<text x="{W/2}" y="29" text-anchor="middle" font-size="12" fill="{t['label']}">{html.escape(title)}</text>
<text x="{CONTENT_X0+2}" y="74" font-size="10" letter-spacing="3" fill="{t['faint']}">VISUAL.MAP</text>
<rect x="{CONTENT_X0}" y="{CONTENT_Y0}" width="{LEFT_W}" height="{CONTENT_Y1-CONTENT_Y0}" rx="10" fill="none" stroke="{t['chrome']}" stroke-width="2" opacity=".45" filter="url(#glow)"/>
<rect x="{CONTENT_X0}" y="{CONTENT_Y0}" width="{LEFT_W}" height="{CONTENT_Y1-CONTENT_Y0}" rx="10" fill="{t['frame']}" stroke="{t['panelborder']}"/>
<!-- Intro: 60 interleaved groups -->
<g fill="{t['portrait']}" shape-rendering="crispEdges">{intro}<animate attributeName="opacity" values="1;1;0" keyTimes="0;.90;1" dur="3.2s" begin="0s" fill="freeze"/></g>
<!-- Dense portrait: 94 drift bands -->
<g color="{t['portrait']}" opacity="0" shape-rendering="crispEdges">{portrait}</g>
<!-- Sparse traveller layer: 900 dots -->
<g fill="{t['portrait']}" shape-rendering="crispEdges">{travellers}</g>
<text x="{RIGHT_X}" y="74" font-size="10" letter-spacing="3" fill="{t['faint']}">SYSTEM.INFO</text>
<rect x="{RIGHT_X}" y="{CONTENT_Y0}" width="{RIGHT_W}" height="{CONTENT_Y1-CONTENT_Y0}" rx="10" fill="none" stroke="{t['chrome']}" stroke-width="2" opacity=".45" filter="url(#glow)"/>
<rect x="{RIGHT_X}" y="{CONTENT_Y0}" width="{RIGHT_W}" height="{CONTENT_Y1-CONTENT_Y0}" rx="10" fill="{t['frame']}" stroke="{t['panelborder']}"/>
<rect x="{RIGHT_X+18}" y="{CONTENT_Y0+16}" width="{pill_w:.1f}" height="24" rx="12" fill="{t['pill']}" stroke="{t['chrome']}" stroke-width="1" opacity=".8"/>
<text x="{RIGHT_X+18+pill_w/2:.1f}" y="{CONTENT_Y0+32}" text-anchor="middle" font-size="14" fill="{t['portrait']}">{pill}</text>
<circle cx="{live_x-38}" cy="{live_y}" r="4" fill="#ef4444"><animate attributeName="opacity" values="1;.25;1" dur="1.4s" repeatCount="indefinite"/></circle>
<text x="{live_x-28}" y="{live_y+4}" font-size="12" letter-spacing="2" fill="{t['label']}">LIVE</text>
{rows}
<rect x="{CONTENT_X0}" y="{CONTENT_Y1+18}" width="{CONTENT_X1-CONTENT_X0}" height="3" rx="1.5" fill="url(#accent)"/>
</g></svg>'''

for theme in ('dark','light'):
    (ROOT/f'{theme}.svg').write_text(build(theme),encoding='utf-8')
    print(theme, (ROOT/f'{theme}.svg').stat().st_size)
