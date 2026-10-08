#!/usr/bin/env python3
"""Fetch latest vendor announcements (no keys). Writes vendor-releases.json."""
import json, re, datetime, urllib.request
import xml.etree.ElementTree as ET
from html import unescape

UA = {"User-Agent": "Mozilla/5.0"}
def get(u):
    return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=20).read().decode("utf-8", "replace")

def rss(u, n=3):
    out = []
    for it in ET.fromstring(get(u)).iter("item"):
        out.append({"title": unescape((it.findtext("title") or "").strip()),
                    "url": (it.findtext("link") or "").strip(),
                    "date": (it.findtext("pubDate") or "")[:16]})
        if len(out) == n: break
    return out

def anthropic(n=3):
    slugs = []
    for s in re.findall(r'href="(/news/[a-z0-9-]+)"', get("https://www.anthropic.com/news")):
        if s not in slugs: slugs.append(s)
    return [{"title": s.split("/")[-1].replace("-", " ").capitalize(), "url": "https://www.anthropic.com" + s, "date": ""} for s in slugs[:n]]

V = {
 "anthropic": ("https://www.anthropic.com/news", anthropic),
 "openai": ("https://openai.com/news/", lambda: rss("https://openai.com/news/rss.xml")),
 "google": ("https://blog.google/technology/ai/", lambda: rss("https://blog.google/technology/ai/rss/")),
 "microsoft": ("https://azure.microsoft.com/en-us/blog/", lambda: []),
}
res = {}
for k, (page, fn) in V.items():
    try: items = fn()
    except Exception as e: print(k, "failed:", e); items = []
    res[k] = {"url": page, "items": items}
    print(k, len(items))
json.dump({"fetched": datetime.date.today().isoformat(), "vendors": res}, open("vendor-releases.json", "w"), indent=1, ensure_ascii=False)
