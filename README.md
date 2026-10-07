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

For each model that passes the filters (context >= minimum and >= input+output tokens, vision if needed, rating for the task > 0):

- `quality = (0.85 * task_rating + 0.15 * speed_rating) / 5` (for the speed task: `speed_rating / 5`)
- `costScore` = 1 - percentile rank of cost among candidates. Cost is the per-request cost when tokens are given, otherwise blended price `(3*in + out)/4` per 1M tokens.
- `score = (1 - w) * quality + w * costScore`, where `w` is:
  - **Best overall**: 0.1 (a light tiebreaker)
  - **Best value**: `max(slider, 0.4)` with tokens, 0.25 without
  - **Top 10 list**: slider with tokens; `0.1 * slider` without tokens (price is only a tiebreaker)
- **Cheapest acceptable**: lowest cost among models rated >= 3 for the task.
- **Usage efficiency** = `quality * (0.7 + 0.3 * speed/5) / (1 + contextUsed)`, shown relative to the best candidate (100). Context used = `(input+output tokens) / context window`.

### "My company pays / ignore cost"

Sets `w = 0` everywhere and hides every $ figure (cards, tables, dashboard price columns, compare). Token usage stays visible: tokens per request, tokens per month, % of context window used and usage efficiency. "Best value" and "Cheapest acceptable" become "Most usage-efficient" and "Fastest acceptable". Without this toggle, entering tokens shows costs per request and per month.

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
