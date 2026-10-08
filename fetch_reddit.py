#!/usr/bin/env python3
"""Collect top Reddit threads mentioning each model -> reddit-signals.json.
Usage: export REDDIT_CLIENT_ID=... REDDIT_CLIENT_SECRET=...; python3 fetch_reddit.py
Stdlib only. Keys come from env vars and are never written to disk."""
import base64, json, os, sys, time, urllib.parse, urllib.request, datetime
UA = "model-picker/1.0 (personal research script)"
SUBS = ["GithubCopilot", "ClaudeAI", "ChatGPTCoding", "OpenAI", "LocalLLaMA", "ChatGPT"]
cid, sec = os.getenv("REDDIT_CLIENT_ID"), os.getenv("REDDIT_CLIENT_SECRET")
if not (cid and sec):
    sys.exit("Missing REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET.\n"
             "Create a 'script' app at https://www.reddit.com/prefs/apps, then export both.")
def call(req):
    with urllib.request.urlopen(req, timeout=20) as r: return json.load(r)
auth = base64.b64encode(f"{cid}:{sec}".encode()).decode()
tok = call(urllib.request.Request("https://www.reddit.com/api/v1/access_token",
    data=b"grant_type=client_credentials", headers={"Authorization": "Basic " + auth, "User-Agent": UA}))["access_token"]
def search(sub, q):
    url = f"https://oauth.reddit.com/r/{sub}/search?" + urllib.parse.urlencode(
        {"q": f'"{q}"', "restrict_sr": 1, "sort": "top", "t": "year", "limit": 10})
    return call(urllib.request.Request(url, headers={"Authorization": "bearer " + tok, "User-Agent": UA}))["data"]["children"]
models = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "github-models.json")))["data"]
out = {}
for m in models:
    seen = {}
    for sub in SUBS:
        try:
            for c in search(sub, m["name"]):
                d = c["data"]
                seen[d["id"]] = {"title": d["title"], "url": "https://www.reddit.com" + d["permalink"],
                                 "sub": d["subreddit"], "score": d["score"], "comments": d["num_comments"]}
        except Exception as e:
            print(f"  ! {sub}/{m['name']}: {e}", file=sys.stderr)
        time.sleep(1)
    top = sorted(seen.values(), key=lambda t: t["score"], reverse=True)
    out[m["id"]] = {"mentions": len(top), "threads": top[:3]}
    print(f"{m['name']}: {len(top)} threads")
json.dump({"fetched": datetime.date.today().isoformat(), "models": out}, open("reddit-signals.json", "w"), indent=1)
print("Wrote reddit-signals.json. Now run: python3 build.py")
