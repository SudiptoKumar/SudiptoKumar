
#!/usr/bin/env python3

"""
Discover all public repositories owned by SudiptoKumar, merge them with the
curated projects.json entries, fetch live GitHub metadata, and create a
deterministic logo for every project.

Curated fields in projects.json (name, description, tags, order, logo) are
preserved. Repositories not listed there are added automatically so the
Projects panel stays in sync with the GitHub account.

Excluded by default:
- the profile README repository itself (SudiptoKumar/SudiptoKumar)
- forks and archived repositories
"""
import json
import os
import re
import sys
import urllib.parse
import urllib.request
import hashlib
from pathlib import Path

OWNER = "SudiptoKumar"
PROFILE_REPO = f"{OWNER}/{OWNER}".lower()
TOKEN = os.environ.get("GITHUB_TOKEN", "")
LOGO_DIR = Path("logos/auto")
PALETTE = ["#7C3AED", "#0891B2", "#059669", "#6366F1", "#A78BFA", "#22D3EE"]

def gh(url):
    req = urllib.request.Request(
        url,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {TOKEN}" if TOKEN else "",
            "User-Agent": "SudiptoKumar-profile-projects",
        },
    )
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)

def slugify(value):
    value = re.sub(r"[^A-Za-z0-9._-]+", "-", value.strip())
    value = re.sub(r"-{2,}", "-", value).strip("-_.")
    return (value or "repo").lower()

def initials(name):
    words = re.findall(r"[A-Za-z0-9]+", name or "")
    if not words:
        return "SK"
    if len(words) == 1:
        return words[0][:2].upper()
    return "".join(w[0] for w in words[:2]).upper()

def make_logo(name, repo):
    """Create a small theme-friendly SVG monogram logo, one unique file/repo."""
    LOGO_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{slugify(repo.split('/')[-1])}.svg"
    path = LOGO_DIR / filename
    seed = hashlib.sha256(repo.encode("utf-8")).hexdigest()
    c1 = PALETTE[int(seed[:4], 16) % len(PALETTE)]
    c2 = PALETTE[int(seed[4:8], 16) % len(PALETTE)]
    txt = initials(name)
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">\n'
        '  <defs>\n'
        f'    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">\n'
        f'      <stop offset="0" stop-color="{c1}"/>\n'
        f'      <stop offset="1" stop-color="{c2}"/>\n'
        '    </linearGradient>\n'
        '  </defs>\n'
        '  <rect x="2" y="2" width="76" height="76" rx="18" fill="#0A101F" stroke="#334155" stroke-width="2"/>\n'
        '  <rect x="9" y="9" width="62" height="62" rx="15" fill="url(#g)" opacity="0.95"/>\n'
        '  <path d="M20 56 L28 30 L37 50 L46 34 L58 56" fill="none" stroke="#F8FAFC" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>\n'
        f'  <text x="40" y="25" text-anchor="middle" font-family="ui-monospace,monospace" font-size="11" font-weight="700" fill="#F8FAFC">{txt}</text>\n'
        '</svg>\n'
    )
    path.write_text(svg)
    return f"auto/{filename}"

def load_config():
    p = Path("projects.json")
    if not p.exists():
        return {}, []
    raw = json.loads(p.read_text())
    if isinstance(raw, list):
        return {}, raw
    return raw, raw.get("projects", [])

def repo_key(repo):
    return repo.strip().replace("https://github.com/", "").replace("http://github.com/", "").rstrip("/").lower()

def fetch_all_repos():
    repos = []
    page = 1
    while True:
        url = f"https://api.github.com/users/{urllib.parse.quote(OWNER)}/repos?per_page=100&page={page}&type=owner&sort=updated"
        batch = gh(url)
        if not batch:
            break
        repos.extend(batch)
        if len(batch) < 100:
            break
        page += 1
    return repos

def normalize_curated(entries):
    out = {}
    for p in entries:
        repo = repo_key(p.get("repo", ""))
        if not repo:
            continue
        p = dict(p)
        p["repo"] = repo
        out[repo] = p
    return out

def main():
    cfg, curated_entries = load_config()
    owner = cfg.get("owner", OWNER)
    if owner != OWNER:
        raise SystemExit(f"owner must remain {OWNER!r}, got {owner!r}")

    excludes = {repo_key(x) for x in cfg.get("exclude_repos", []) if x}
    excludes.add(PROFILE_REPO)

    curated = normalize_curated(curated_entries)
    ordered = []
    seen = set()

    # Curated entries first, in their existing order.
    for repo, p in curated.items():
        if repo in excludes or repo in seen:
            continue
        ordered.append(p)
        seen.add(repo)

    # Discover every owned public, non-fork, non-archived repository.
    all_repos = []
    try:
        all_repos = fetch_all_repos()
    except Exception as e:
        print(f"warning: repository discovery failed: {e}", file=sys.stderr)

    for info in all_repos:
        repo = info.get("full_name", "").lower()
        if not repo or repo in excludes or repo in seen:
            continue
        if info.get("fork") or info.get("archived"):
            continue

        name = info.get("name") or repo.split("/", 1)[-1]
        description = info.get("description") or ""
        lang = info.get("language")
        topics = info.get("topics") or []
        tags = []
        if lang:
            tags.append(lang)
        tags.extend([t.replace("-", " ").title() for t in topics if t])
        if not tags:
            tags = ["GitHub"]

        ordered.append({
            "name": name,
            "repo": repo,
            "description": description,
            "tags": tags[:3],
            "order": len(ordered),
        })
        seen.add(repo)

    if not ordered:
        raise SystemExit("No projects found. Check GitHub API access.")

    # Fetch live metadata and ensure every project has a generated logo.
    for p in ordered:
        repo = repo_key(p["repo"])
        p["repo"] = repo
        try:
            info = gh(f"https://api.github.com/repos/{repo}")
            p["stars"] = info.get("stargazers_count", 0)
            p["pushed_at"] = info.get("pushed_at")

            if not p.get("description"):
                p["description"] = info.get("description") or ""

            if not p.get("tags") or p.get("tags") == ["GitHub"]:
                lang = info.get("language")
                topics = info.get("topics") or []
                tags = [lang] if lang else []
                tags.extend([t.replace("-", " ").title() for t in topics if t])
                p["tags"] = (tags or ["GitHub"])[:3]

            p["languages"] = gh(f"https://api.github.com/repos/{repo}/languages")
        except Exception as e:
            print(f"warning: could not fetch {repo}: {e}", file=sys.stderr)
            p.setdefault("stars", 0)
            p.setdefault("languages", {})
            p.setdefault("pushed_at", None)

        if not p.get("logo"):
            p["logo"] = make_logo(p.get("name", repo.split("/")[-1]), repo)

    Path("merged.json").write_text(json.dumps(ordered, indent=2, ensure_ascii=False))
    print(f"merged {len(ordered)} projects")

if __name__ == "__main__":
    main()
