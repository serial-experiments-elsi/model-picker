#!/usr/bin/env python3
"""List recent OpenRouter models from major vendors that aren't in github-models.json yet."""
import json, time, urllib.request
VENDORS = ("anthropic/", "openai/", "google/", "x-ai/")
have = {m["id"] for m in json.load(open("github-models.json"))["data"]}
req = urllib.request.Request("https://openrouter.ai/api/v1/models", headers={"User-Agent": "model-picker"})
try:
    data = json.load(urllib.request.urlopen(req, timeout=30))["data"]
except Exception as e:
    print(f"(skipped: OpenRouter unreachable: {e})", file=__import__("sys").stderr)
    raise SystemExit(0)
cutoff = time.time() - 60 * 86400
new = [m for m in data if m["id"].startswith(VENDORS) and m.get("created", 0) > cutoff
       and m["id"] not in have and ":" not in m["id"]]
for m in sorted(new, key=lambda m: -m["created"]):
    print(f"- {m['id']} ({m.get('name','')})")
