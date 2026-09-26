#!/usr/bin/env python3
import json, os, html, urllib.request
from pathlib import Path
OWNER='SudiptoKumar'; TOKEN=os.environ.get('GITHUB_TOKEN','')
DARK={'bg':'#0A101F','cyan':'#22D3EE','violet':'#A78BFA','text':'#F8FAFC','muted':'#94A3B8'}
LIGHT={'bg':'#F8FAFC','cyan':'#0891B2','violet':'#7C3AED','text':'#0F172A','muted':'#475569'}
def req(url):
    r=urllib.request.Request(url,headers={'Accept':'application/vnd.github+json','Authorization':f'Bearer {TOKEN}','User-Agent':'SudiptoKumar-profile'})
    with urllib.request.urlopen(r,timeout=20) as x:return json.load(x)
def gql(q):
    r=urllib.request.Request('https://api.github.com/graphql',data=json.dumps({'query':q}).encode(),headers={'Accept':'application/vnd.github+json','Authorization':f'Bearer {TOKEN}','Content-Type':'application/json','User-Agent':'SudiptoKumar-profile'})
    with urllib.request.urlopen(r,timeout=20) as x:return json.load(x)
def esc(x):return html.escape(str(x),quote=True)
def collect():
    repos=[]; page=1
    while True:
        b=req(f'https://api.github.com/users/{OWNER}/repos?per_page=100&page={page}&type=owner')
        if not b:break
        repos += [r for r in b if not r.get('fork') and not r.get('archived') and r.get('name')!=OWNER]
        if len(b)<100:break
        page+=1
    langs={}
    for r in repos:
        try:
            for k,v in req(r['languages_url']).items():langs[k]=langs.get(k,0)+v
        except Exception:pass
    q='''query { user(login:"SudiptoKumar") { followers { totalCount } contributionsCollection { totalCommitContributions restrictedContributionsCount totalIssueContributions totalPullRequestContributions } } }'''
    u=gql(q).get('data',{}).get('user',{}); c=u.get('contributionsCollection',{})
    m={'stars':sum(r.get('stargazers_count',0) for r in repos),'repos':len(repos),'commits':c.get('totalCommitContributions',0)+c.get('restrictedContributionsCount',0),'prs':c.get('totalPullRequestContributions',0),'issues':c.get('totalIssueContributions',0),'followers':u.get('followers',{}).get('totalCount',0)}
    return m,langs
def stats(m,t):
    c=DARK if t=='dark' else LIGHT; items=[('Stars',m['stars'],'★'),('Repositories',m['repos'],'●'),('Commits',m['commits'],'◆'),('Pull Requests',m['prs'],'↗'),('Issues',m['issues'],'!'),('Followers',m['followers'],'@')]
    s=[f'<svg xmlns="http://www.w3.org/2000/svg" width="500" height="200" viewBox="0 0 500 200"><rect width="500" height="200" rx="12" fill="{c["bg"]}"/><rect x="1" y="1" width="498" height="198" rx="12" fill="none" stroke="{c["cyan"]}" stroke-opacity=".25"/><text x="24" y="34" font-family="ui-monospace,monospace" font-size="18" font-weight="700" fill="{c["text"]}">Sudipto\'s GitHub stats</text>']
    for i,(lab,val,ico) in enumerate(items):
        x=24+(i%3)*160;y=68+(i//3)*62;s += [f'<text x="{x}" y="{y}" font-family="ui-monospace,monospace" font-size="11" fill="{c["cyan"]}">{esc(ico)}  {esc(lab)}</text>',f'<text x="{x}" y="{y+25}" font-family="ui-monospace,monospace" font-size="20" font-weight="700" fill="{c["text"]}">{val:,}</text>']
    return ''.join(s+['</svg>'])
def langs_svg(langs,t):
    c=DARK if t=='dark' else LIGHT; top=sorted(langs.items(),key=lambda x:-x[1])[:8]; total=sum(langs.values()) or 1; cols=['#22D3EE','#A78BFA','#10B981','#6366F1','#F59E0B','#EC4899','#14B8A6','#64748B'];s=[f'<svg xmlns="http://www.w3.org/2000/svg" width="500" height="200" viewBox="0 0 500 200"><rect width="500" height="200" rx="12" fill="{c["bg"]}"/><rect x="1" y="1" width="498" height="198" rx="12" fill="none" stroke="{c["cyan"]}" stroke-opacity=".25"/><text x="24" y="34" font-family="ui-monospace,monospace" font-size="18" font-weight="700" fill="{c["text"]}">Top languages</text>'];cur=0
    for i,(n,v) in enumerate(top):
        w=452*v/total;s.append(f'<rect x="{24+cur:.1f}" y="55" width="{max(w,2):.1f}" height="11" fill="{cols[i%len(cols)]}"/>');cur+=w
    for i,(n,v) in enumerate(top[:6]):
        x=24+(i%3)*155;y=92+(i//3)*38;p=v/total*100;s += [f'<circle cx="{x}" cy="{y-4}" r="4" fill="{cols[i%len(cols)]}"/>',f'<text x="{x+11}" y="{y}" font-family="ui-monospace,monospace" font-size="11" fill="{c["muted"]}">{esc(n)} {p:.1f}%</text>']
    return ''.join(s+['</svg>'])
if __name__=='__main__':
    o=Path('out');o.mkdir(exist_ok=True);m,l=collect();(o/'stats.svg').write_text(stats(m,'dark'));(o/'stats-light.svg').write_text(stats(m,'light'));(o/'languages.svg').write_text(langs_svg(l,'dark'));(o/'languages-light.svg').write_text(langs_svg(l,'light'));print(m)
