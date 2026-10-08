#!/usr/bin/env python3
"""Collect forum threads per model -> forum-signals.json.
Sources: Hacker News (Algolia), Lobsters (tag feeds), Dev.to, Stack Overflow (no keys);
GitHub Discussions only if GITHUB_TOKEN is set. Stdlib only."""
import json, os, re, sys, time, datetime, urllib.parse, urllib.request
UA = {"User-Agent": "model-picker/1.0 (personal research script)"}
here = os.path.dirname(os.path.abspath(__file__))
def get(url, headers=None, data=None):
    req = urllib.request.Request(url, headers={**UA, **(headers or {})}, data=data)
    with urllib.request.urlopen(req, timeout=20) as r: return json.load(r)
models = json.load(open(os.path.join(here, "github-models.json")))["data"]

def hn(q):
    j = get("https://hn.algolia.com/api/v1/search?" + urllib.parse.urlencode({"query": q, "tags": "story", "hitsPerPage": 10}))
    return [{"title": h["title"], "url": f"https://news.ycombinator.com/item?id={h['objectID']}", "src": "HN", "score": h.get("points") or 0}
            for h in j["hits"] if h.get("title")]
def so(q):
    j = get("https://api.stackexchange.com/2.3/search/advanced?" + urllib.parse.urlencode(
        {"q": q, "site": "stackoverflow", "order": "desc", "sort": "votes", "pagesize": 10}))
    return [{"title": re.sub("&#39;|&quot;|&amp;", "'", i["title"]), "url": i["link"], "src": "StackOverflow", "score": i["score"]} for i in j["items"]]
def gh(q):
    tok = os.getenv("GITHUB_TOKEN")
    if not tok: return []
    query = 'query($q:String!){search(query:$q,type:DISCUSSION,first:10){nodes{... on Discussion{title url upvoteCount}}}}'
    j = get("https://api.github.com/graphql", {"Authorization": "bearer " + tok, "Content-Type": "application/json"},
            json.dumps({"query": query, "variables": {"q": q + " sort:interactions-desc"}}).encode())
    return [{"title": n["title"], "url": n["url"], "src": "GH Discussions", "score": n["upvoteCount"]}
            for n in j["data"]["search"]["nodes"] if n]
# Lobsters and Dev.to have no keyword search API: pull tag feeds once, filter by title per model.
feeds = []
for tag in ("ai", "ml", "programming"):
    try: feeds += [{"title": s["title"], "url": s["comments_url"], "src": "Lobsters", "score": s["score"]}
                   for s in get(f"https://lobste.rs/t/{tag}.json")]
    except Exception as e: print("  ! lobsters", tag, e, file=sys.stderr)
for tag in ("llm", "ai", "githubcopilot"):
    try: feeds += [{"title": a["title"], "url": a["url"], "src": "Dev.to", "score": a["public_reactions_count"]}
                   for a in get(f"https://dev.to/api/articles?tag={tag}&top=30&per_page=100")]
    except Exception as e: print("  ! dev.to", tag, e, file=sys.stderr)

def norm(s): return re.sub(r"[^a-z0-9]", "", s.lower())
out = {}
for m in models:
    n = norm(m["name"]); seen = {}
    for fn in (hn, so, gh):
        try:
            for t in fn(m["name"]): seen[t["url"]] = t
        except Exception as e: print(f"  ! {fn.__name__}/{m['name']}: {e}", file=sys.stderr)
        time.sleep(1)
    for t in feeds:
        if n in norm(t["title"]): seen[t["url"]] = t
    ok = [t for t in seen.values() if n in norm(t["title"])]
    top = sorted(ok, key=lambda t: t["score"], reverse=True)
    out[m["id"]] = {"mentions": len(top), "threads": top[:3]}
    print(f"{m['name']}: {len(top)} threads")
json.dump({"fetched": datetime.date.today().isoformat(), "models": out}, open(os.path.join(here, "forum-signals.json"), "w"), indent=1)
print("Wrote forum-signals.json. Now run: python3 build.py")
