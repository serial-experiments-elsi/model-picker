# Model Picker

Pick an LLM for a task with token usage and cost in mind. Plain HTML/CSS/JS: no build step, no dependencies.

## Run

```
python3 -m http.server   # then open http://localhost:8000
```

Opening `index.html` directly also works for live prices, but browsers block `fetch` of local JSON on `file://`, so curated ratings and the offline snapshot only load through a local server.

## Data

- **Live**: `https://openrouter.ai/api/v1/models` (no key) gives prices, context windows and modalities. Cached in `localStorage` for 6 hours; the **Refresh** button forces a fetch.
- **Fallback**: if the live fetch fails, stale cache is used, then `models-snapshot.json` (same shape as the API, approximate prices).
- **Curated**: `models-curated.json` holds the tier plus 1-5 ratings (coding, reasoning, writing, extraction, vision, speed) and notes. Models without an entry still appear, with a heuristic tier from blended price (>= $10/1M flagship, >= $1 balanced, else fast-cheap) and default ratings for that tier, marked "heuristic".

## Views

1. **Recommender**: task type, quality-vs-cost slider, and optional inputs (input tokens, output tokens, monthly requests, minimum context, vision needed). Shows Best overall, Best value, Cheapest acceptable, plus a top 10.
2. **Dashboard**: sortable, filterable table with compare checkboxes.
3. **Token tips**.

All token/volume inputs are optional.

## Scoring

### Task types

- **General** (benchmarked directly): coding, reasoning, writing, extraction, vision, speed.
- **Blended types** are weighted mixes of the six base ratings, so no per-model scores are invented:

| Task | Blend |
|---|---|
| UI / visual design review | vision .6, reasoning .4 |
| UX writing & microcopy | writing .7, reasoning .3 |
| UX research synthesis | extraction .5, reasoning .5 |
| Design → front-end code | coding .7, vision .3 |
| Data & spreadsheets | reasoning .5, extraction .3, coding .2 |
| Brainstorming & ideation | writing .5, reasoning .5 |
| Multi-step agent tasks | coding .5, reasoning .5 |
| Long documents | extraction .6, reasoning .4 (pair with a high minimum context) |
| Translation & localization | writing .6, extraction .4 |

The task is detected from the prompt with keyword matching. Domain phrases such as "microcopy", "persona" or "design tokens" count three times as much as generic words. You can always override the choice in the dropdown.

For each model that passes the filters (context >= minimum and >= input+output tokens, vision if needed, rating for the task > 0):

- `quality = (0.85 * task_rating + 0.15 * speed_rating) / 5` (for the speed task: `speed_rating / 5`)
- `costScore` = 1 - percentile rank of cost among candidates. Cost is the per-request cost when tokens are given, otherwise blended price `(3*in + out)/4` per 1M tokens.
- `score = (1 - w) * quality + w * costScore`, where `w` is:
  - **Best overall**: 0.1 (a light tiebreaker)
  - **Best value**: `max(slider, 0.4)` with tokens, 0.25 without
  - **Top 10 list**: slider with tokens; `0.1 * slider` without tokens (price is only a tiebreaker)
- **Cheapest acceptable**: lowest cost among models rated >= 3 for the task.
- **Usage efficiency** = `quality * (0.7 + 0.3 * speed/5) / (1 + contextUsed)`, shown relative to the best candidate (100). Context used = `(input+output tokens) / context window`.


## Updating curated ratings when new models launch

1. Find the model id at `https://openrouter.ai/api/v1/models` (e.g. `vendor/model-name`).
2. Add an entry to `models-curated.json`:
   ```json
   "vendor/model-name": {
     "tier": "balanced",
     "ratings": {"coding": 4, "reasoning": 4, "writing": 4, "extraction": 4, "vision": 3, "speed": 3},
     "notes": "One-line guidance."
   }
   ```
   Use 1-5 (vision 0 if unsupported; non-image models are forced to 0 anyway).
3. Reload. Optionally refresh `models-snapshot.json` by saving the live API response to it.

## Sharing with colleagues

Run `python3 build.py` to produce **`model-picker.html`**: a single self-contained file
(CSS, JS, curated ratings and offline snapshot all inlined). Email or drop it on a shared drive;
it opens by double-click, no server needed. It still tries live OpenRouter prices when online.
Rebuild after editing `models-curated.json` or the snapshot.

## GitHub Copilot models only

Recommendations and the dashboard are restricted to the 12 models in `github-models.json`. Ratings, context and prices there are **estimates**; Copilot actually bills by premium-request multipliers, not $/token.

## Data sources & roadmap
- **Premium-request multipliers** (shown on cards): from GitHub's legacy annual-plan multiplier table. Published for only 6 of the 12 models (Haiku 4.5, GPT-5.5, GPT-5.4 mini, GPT-5 mini, GPT-5.3-Codex, MAI-Code-1.1-Flash); others show "not published". They don't apply to usage-based billing.
- **Quality ratings / prices**: hand-curated estimates in `github-models.json`.
- **Not yet wired**: LMArena / Artificial Analysis scores (no stable API; add as `_ratings` when sourced).

## Reddit experiences (optional)
Skippable: the app works fully without Reddit (Hacker News, Lobsters, Dev.to, Stack Overflow and GitHub Discussions need no key). Browsers can't call Reddit directly, and unauthenticated Reddit requests return 403, so this is an offline step. Reddit now requires registering for API access (its Responsible Builder Policy, linked from the create-app form) and may take time to approve. You can also hand-edit `reddit-signals.json` with thread links.
1. Go to https://www.reddit.com/prefs/apps → "create another app" → type **script** (redirect URI `http://localhost`). Copy the client id (under the app name) and the secret.
2. Run:
   ```
   export REDDIT_CLIENT_ID=... REDDIT_CLIENT_SECRET=...
   python3 fetch_reddit.py && python3 build.py
   ```
3. Each model card then shows its top Reddit threads (links, subreddit, upvotes). Re-run to refresh. Keys are never saved; `reddit-signals.json` holds only public thread titles/links.

## Vendor news (optional)
`python3 fetch_releases.py` (no keys) pulls the latest posts from OpenAI and Google (RSS) and Anthropic (scraped, may break) into `vendor-releases.json`; Microsoft is a link only. Then `python3 build.py`. Cards show a "Latest from vendor" row.

## Forum signals (HN, Lobsters, Dev.to, Stack Overflow, GitHub Discussions)
`python3 fetch_forums.py && python3 build.py` pulls top threads that mention each model by name and shows them as "Forum chatter" on the cards. No keys needed; set `GITHUB_TOKEN` to also include GitHub Discussions. Output: `forum-signals.json`.

### Community buzz nudge
Forum + Reddit mention counts add a community bonus (max 0.3 on a 0–1 scale, roughly two steps along the quality–cost frontier) to mid-slider rankings. It measures how much people are using and discussing a model, not sentiment, and never affects the slider extremes.

## Keeping it up to date

- `./update.sh` refreshes vendor releases and forum signals (and Reddit if `REDDIT_CLIENT_ID`/`REDDIT_CLIENT_SECRET` are set), then rebuilds `model-picker.html`.
- `python3 check_new_models.py` lists recent models from major vendors that aren't in `github-models.json` yet; add ratings there by hand.
- `.github/workflows/update.yml` runs all of this weekly, commits the result, opens an issue when new models appear, and deploys `model-picker.html` to GitHub Pages. To use it: push to a GitHub repo, set Settings → Pages → Source: GitHub Actions, and optionally add the Reddit secrets.
- Prices, context and modalities are always live from OpenRouter. Ratings are hand-curated.
