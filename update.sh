#!/usr/bin/env bash
# Refresh all data and rebuild model-picker.html
set -e
cd "$(dirname "$0")"
python3 fetch_releases.py || echo "releases failed, keeping old data"
python3 fetch_forums.py || echo "forums failed, keeping old data"
if [ -n "$REDDIT_CLIENT_ID" ] && [ -n "$REDDIT_CLIENT_SECRET" ]; then
  python3 fetch_reddit.py || echo "reddit failed, keeping old data"
fi
python3 build.py
