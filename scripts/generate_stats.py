#!/usr/bin/env python3
"""Stats + languages cards in the profile's shared identity (ink green, brass, mint).
Actions: needs GITHUB_TOKEN.   Offline preview: python3 scripts/generate_stats.py --demo"""
import json, math, os, sys, html, urllib.request
from datetime import date
from pathlib import Path

OWNER = 'SudiptoKumar'; TOKEN = os.environ.get('GITHUB_TOKEN', '')
W, H, L, R = 578, 244, 28, 550
SANS = "system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',sans-serif"
SERIF = "'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif"
T = {
  'dark': dict(bg1='#0D1815', bg2='#09110F', line='#21372D', text='#F1F6F2', mute='#8FA69B', brass='#E6B450', mint='#7EE8C0', track='#173027',
               langs=['#7EE8C0', '#E6B450', '#B8F27C', '#F08A6B', '#7CC4E8', '#B9A4F0']),
  'light': dict(bg1='#FFFFFF', bg2='#EEF3EF', line='#C3D1C8', text='#0E2119', mute='#3F5A4E', brass='#9A6A0B', mint='#0F8A63', track='#DCE6DF',
                langs=['#0F8A63', '#9A6A0B', '#4D7C0F', '#C2543A', '#1E7FB0', '#7B5FD0']),
}
esc = lambda x: html.escape(str(x), quote=True)

def call(url, body=None):
    h = {'Accept': 'application/vnd.github+json', 'Authorization': f'Bearer {TOKEN}', 'User-Agent': f'{OWNER}-profile'}
    if body: h['Content-Type'] = 'application/json'
    with urllib.request.urlopen(urllib.request.Request(url, data=body, headers=h), timeout=20) as r:
        return json.load(r)

def collect():
    repos, page = [], 1
    while True:
        b = call(f'https://api.github.com/users/{OWNER}/repos?per_page=100&page={page}&type=owner')
        repos += [r for r in b if not r.get('fork') and not r.get('archived') and r['name'] != OWNER]
        if len(b) < 100: break
        page += 1
    langs = {}
    for r in repos:
        try:
            for k, v in call(r['languages_url']).items(): langs[k] = langs.get(k, 0) + v
        except Exception: pass
    q = ('{ user(login:"%s") { followers { totalCount } contributionsCollection { totalCommitContributions restrictedContributionsCount '
         'totalIssueContributions totalPullRequestContributions contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } } } } }' % OWNER)
    u = call('https://api.github.com/graphql', json.dumps({'query': q}).encode()).get('data', {}).get('user', {})
    c = u.get('contributionsCollection', {}); cal = c.get('contributionCalendar', {}); wk = cal.get('weeks', [])
    days = [d for w in wk for d in w['contributionDays']]
    best = run = 0
    for d in days:
        run = run + 1 if d['contributionCount'] else 0; best = max(best, run)
    cur, today = 0, date.today().isoformat()
    for d in reversed(days):
        if d['date'] > today: continue
        if d['contributionCount']: cur += 1
        elif d['date'] != today: break
    m = dict(year=cal.get('totalContributions', 0), cur=cur, best=best, repos=len(repos),
             commits=c.get('totalCommitContributions', 0) + c.get('restrictedContributionsCount', 0),
             prs=c.get('totalPullRequestContributions', 0), issues=c.get('totalIssueContributions', 0),
             stars=sum(r.get('stargazers_count', 0) for r in repos), followers=u.get('followers', {}).get('totalCount', 0))
    return m, langs, [sum(d['contributionCount'] for d in w['contributionDays']) for w in wk] or [0, 0]

def demo():
    weeks = [max(2, round(18 + 14 * math.sin(i / 3.1) + 9 * math.sin(i / 1.3 + 1) + i * .4)) for i in range(53)]
    m = dict(year=sum(weeks), cur=23, best=61, commits=1520, prs=84, issues=31, stars=212, followers=148, repos=14)
    return m, {'Python': 720, 'TypeScript': 410, 'JavaScript': 260, 'Kotlin': 120, 'HTML': 90, 'CSS': 70, 'Shell': 30}, weeks

def frame(t, label):
    c = T[t]
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="{SANS}" role="img" aria-label="{label}"><defs>'
            f'<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{c["bg1"]}"/><stop offset="1" stop-color="{c["bg2"]}"/></linearGradient>'
            f'<linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{c["mint"]}" stop-opacity=".32"/><stop offset="1" stop-color="{c["mint"]}" stop-opacity="0"/></linearGradient>'
            f'<linearGradient id="ln" gradientUnits="userSpaceOnUse" x1="{L}" y1="0" x2="{R}" y2="0"><stop offset="0" stop-color="{c["mint"]}"/><stop offset="1" stop-color="{c["brass"]}"/></linearGradient></defs>'
            f'<rect width="{W}" height="{H}" rx="16" fill="url(#bg)"/><rect x=".5" y=".5" width="{W-1}" height="{H-1}" rx="15.5" fill="none" stroke="{c["line"]}"/>'
            f'<rect x="{L}" width="34" height="3" fill="{c["brass"]}"/>')

def spark(vals, y0=112, y1=164):
    n = max(len(vals) - 1, 1); hi = max(vals) or 1
    pts = [(L + (R - L) * i / n, y1 - (y1 - y0) * v / hi) for i, v in enumerate(vals)]
    d = f'M{pts[0][0]:.1f} {pts[0][1]:.1f}'
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        mid = (ax + bx) / 2; d += f'C{mid:.1f} {ay:.1f} {mid:.1f} {by:.1f} {bx:.1f} {by:.1f}'
    return d, pts[-1]

def stats_card(m, weeks, t):
    c = T[t]; d, (ex, ey) = spark(weeks)
    s = [frame(t, 'GitHub activity')]
    s.append(f'<text x="{L}" y="42" font-size="12" fill="{c["mute"]}">Contributions in the last year</text>'
             f'<text x="{L}" y="88" font-family="{SERIF}" font-size="44" fill="{c["text"]}">{m["year"]:,}</text>'
             f'<line x1="318" y1="28" x2="318" y2="92" stroke="{c["line"]}"/>'
             f'<text x="338" y="42" font-size="12" fill="{c["mute"]}">Current streak</text>'
             f'<text x="338" y="88" font-family="{SERIF}" font-size="44" fill="{c["brass"]}">{m["cur"]}<tspan font-family="{SANS}" font-size="13" fill="{c["mute"]}" dx="6">days</tspan></text>'
             f'<text x="{R}" y="88" text-anchor="end" font-size="12" fill="{c["mute"]}">best {m["best"]}</text>')
    s.append(f'<path d="{d}L{R} 172L{L} 172Z" fill="url(#fill)"/>'
             f'<path d="{d}" pathLength="1" fill="none" stroke="url(#ln)" stroke-width="2" stroke-linecap="round" stroke-dasharray="1" stroke-dashoffset="1">'
             f'<animate attributeName="stroke-dashoffset" from="1" to="0" dur="1.8s" begin=".2s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".3 0 .2 1"/></path>'
             f'<g opacity="0"><animate attributeName="opacity" to="1" dur=".3s" begin="1.9s" fill="freeze"/>'
             f'<circle cx="{ex:.1f}" cy="{ey:.1f}" r="3.5" fill="{c["brass"]}"/>'
             f'<circle cx="{ex:.1f}" cy="{ey:.1f}" r="3.5" fill="none" stroke="{c["brass"]}"><animate attributeName="r" values="3.5;11" dur="2.4s" repeatCount="indefinite"/>'
             f'<animate attributeName="opacity" values=".8;0" dur="2.4s" repeatCount="indefinite"/></circle></g>')
    items = [('Commits', m['commits']), ('Pull requests', m['prs']), ('Issues', m['issues']), ('Stars', m['stars']), ('Followers', m['followers'])]
    s.append(f'<line x1="{L}" y1="184" x2="{R}" y2="184" stroke="{c["line"]}"/>')
    for i, (lab, val) in enumerate(items):
        x = L + i * (R - L) / len(items)
        s.append(f'<text x="{x:.0f}" y="212" font-family="{SERIF}" font-size="21" fill="{c["text"]}">{val:,}</text>'
                 f'<text x="{x:.0f}" y="228" font-size="11" fill="{c["mute"]}">{lab}</text>')
    return ''.join(s) + '</svg>'

def langs_card(langs, nrepos, t):
    c = T[t]; top = sorted(langs.items(), key=lambda kv: -kv[1])[:6] or [('n/a', 1)]
    total = sum(langs.values()) or 1; sub = sum(v for _, v in top)
    s = [frame(t, 'Top languages')]
    s.append(f'<text x="{L}" y="42" font-size="15" font-weight="600" fill="{c["text"]}">Top languages</text>'
             f'<text x="{R}" y="42" text-anchor="end" font-size="12" fill="{c["mute"]}">across {nrepos} repositories</text>')
    avail, x, segs = R - L - 3 * (len(top) - 1), L, []
    for i, (_, v) in enumerate(top):
        w = max(v / sub * avail, 6); segs.append(f'<rect x="{x:.1f}" y="60" width="{w:.1f}" height="14" rx="4" fill="{c["langs"][i]}"/>'); x += w + 3
    s.append(f'<clipPath id="rv"><rect x="{L}" y="56" width="0" height="22"><animate attributeName="width" from="0" to="{R-L}" dur="1.1s" begin=".2s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".3 0 .2 1"/></rect></clipPath>'
             f'<g clip-path="url(#rv)">{"".join(segs)}</g>')
    n0, v0 = top[0]
    s.append(f'<text x="{L}" y="112" font-size="12" fill="{c["mute"]}">Most written</text>'
             f'<text x="{L}" y="162" font-family="{SERIF}" font-size="52" fill="{c["langs"][0]}">{v0 / total * 100:.0f}<tspan font-size="24" dx="2">%</tspan></text>'
             f'<text x="{L}" y="188" font-size="15" font-weight="600" fill="{c["text"]}">{esc(n0)}</text>')
    for i, (n, v) in enumerate(top):
        cx, y = 214 + (i % 2) * 184, 118 + (i // 2) * 42
        s.append(f'<circle cx="{cx}" cy="{y-4}" r="4" fill="{c["langs"][i]}"/><text x="{cx+12}" y="{y}" font-size="13" fill="{c["text"]}">{esc(n)}</text>'
                 f'<text x="{cx+150}" y="{y}" text-anchor="end" font-size="12" fill="{c["mute"]}">{v / total * 100:.1f}%</text>'
                 f'<rect x="{cx}" y="{y+9}" width="150" height="3" rx="1.5" fill="{c["track"]}"/>'
                 f'<rect x="{cx}" y="{y+9}" width="{max(150 * v / top[0][1], 3):.1f}" height="3" rx="1.5" fill="{c["langs"][i]}"/>')
    return ''.join(s) + '</svg>'

if __name__ == '__main__':
    m, langs, weeks = demo() if '--demo' in sys.argv else collect()
    o = Path('out'); o.mkdir(exist_ok=True)
    for t, suf in (('dark', ''), ('light', '-light')):
        (o / f'stats{suf}.svg').write_text(stats_card(m, weeks, t))
        (o / f'languages{suf}.svg').write_text(langs_card(langs, m['repos'], t))
    print(m)
