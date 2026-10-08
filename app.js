(() => {
const API = "https://openrouter.ai/api/v1/models";
const CACHE_KEY = "modelPicker.cache.v1", TTL = 6 * 3600 * 1000;
const $ = id => document.getElementById(id);
const RK = ["coding", "reasoning", "writing", "extraction", "vision", "speed"];
// Extra task types are weighted blends of the 6 benchmarked ratings, so no per-model scores are invented
const BLEND = {
  uxdesign:{vision:.6,reasoning:.4}, uxwriting:{writing:.7,reasoning:.3}, research:{extraction:.5,reasoning:.5},
  frontend:{coding:.7,vision:.3}, data:{reasoning:.5,extraction:.3,coding:.2}, ideation:{writing:.5,reasoning:.5},
  agentic:{coding:.5,reasoning:.5}, longdoc:{extraction:.6,reasoning:.4}, translation:{writing:.6,extraction:.4}};
const TASK_LABEL = {coding:"Coding",reasoning:"Reasoning",writing:"Writing",extraction:"Summarization/extraction",vision:"Vision",speed:"Speed",
  uxdesign:"UI / visual design review",uxwriting:"UX writing & microcopy",research:"UX research synthesis",frontend:"Design → front-end code",
  data:"Data & spreadsheets",ideation:"Brainstorming & ideation",agentic:"Multi-step agent tasks",longdoc:"Long documents",translation:"Translation & localization"};
const HEUR = { // fallback ratings by price tier
  flagship:{coding:4,reasoning:4,writing:4,extraction:4,vision:4,speed:2},
  balanced:{coding:3,reasoning:3,writing:3,extraction:3,vision:3,speed:3},
  "fast-cheap":{coding:2,reasoning:2,writing:3,extraction:3,vision:2,speed:5}};
let ghModels = [], models = [], source = "", sortKey = "name", sortDir = 1;
const selected = new Set();
const KW = {
  uxdesign: /\b(figma|design|mockup|wireframe|layout|ui\b|ux\b|typograph|branding|logo|icon|banner|poster|graphic|illustrat|moodboard|palette|visual)\w*/i,
  uxwriting: /\b(microcopy|copy|label|tooltip|cta|headline|wording|phrasing)\w*/i,
  research: /\b(interview|survey|persona|insight|finding|usability|participant|user research|feedback|synthes)\w*/i,
  frontend: /\b(frontend|front-end|css|html|react|component|tailwind|responsive|vue|svelte|figma to code)\w*/i,
  data: /\b(spreadsheet|excel|csv|dataset|pandas|dashboard|metric|kpi|pivot|chart data|analytics|sql query|formula)\w*/i,
  ideation: /\b(brainstorm|ideas?|ideat|concepts?|name|names|naming|slogan|tagline|creative|inspiration|alternatives)\w*/i,
  agentic: /\b(agent|agentic|multi-?step|automat|workflow|pipeline|orchestrat|tool use|autonomous|end-to-end)\w*/i,
  longdoc: /\b(long document|book|report|contract|whitepaper|thesis|manual|100 pages|entire (doc|codebase|repo)|large file|hundreds of pages)\w*/i,
  translation: /\b(translat|locali[sz]|i18n|l10n|spanish|french|german|japanese|chinese|portuguese|italian|multilingual)\w*/i,
  vision: /\b(image|photo|picture|screenshot|diagram|ocr|chart|scan|vision|video|infographic|sketch|draw)\w*/i,
  coding: /\b(code|coding|function|bug|debug|refactor|script|python|javascript|typescript|java|rust|golang|sql|regex|api|unit test|test case|compil|repo|program|develop|software|backend|app\b|website|deploy|algorithm)\w*/i,
  extraction: /\b(summari|summary|extract|classif|tag|parse|pdf|invoice|transcript|json|table|categori|sentiment|tl;?dr|digest|notes|data entry)\w*/i,
  reasoning: /\b(reason|analy|math|proof|plan|strateg|logic|puzzle|decid|decision|compar|trade-?off|why|evaluat|diagnos|solve|problem|forecast|critique|review|architect|how|what|should|best|advice|suggest|recommend|help|think|calculat|estimat|optimi)\w*/i,
  writing: /\b(write|writing|essay|blog|email|article|story|stories|rewrite|draft|poem|marketing|post|tone|script|pitch|content|caption|speech|newsletter|edit|proofread|letter|message|reply|respond|describe|explain|rephrase|paraphras|polish|brief|outline|resume|cv|cover|bio|description|text|documentation|docs)\w*/i,
  speed: /\b(chat|chatbot|quick|real-?time|latency|fast|autocomplete|instant|conversation|support bot|assistant)\w*/i};
// Strong phrases count 3 so they outweigh generic words like "help" or "what"
const KW_STRONG = {
  uxdesign: /\b(wireframe|mock-?up|hi-?fi|lo-?fi|visual hierarchy|colou?r (palette|contrast|scheme)|contrast ratio|moodboard|mood board|style ?guide|ui kit|design critique|heuristic evaluation|usability review of (a )?screen|app screen|landing page design|iconograph|brand identity|accessib\w* (audit|contrast)|design system|information architecture|user flow|design principle|onboarding flow|figma)\w*/gi,
  uxwriting: /\b(micro-?copy|ux (copy|writing)|content design|empty state|error (message|state)|button (label|text)|tone of voice|voice and tone|onboarding (copy|text)|tooltip|cta|release notes|help text|placeholder text|confirmation message|rewrite (this )?(copy|text)|alt text)\w*/gi,
  research: /\b(persona|user journey|journey map|empathy map|card sort|tree test|usability (test|issue|notes|recordings?)|jobs? to be done|jtbd|how might we|hmw|affinity|ux research|user research|pain points?|service blueprint|interview (notes|transcript)|survey (responses|results)|user feedback|open-?ended|synthesi[sz]e|tag (the )?feedback)\w*/gi,
  frontend: /\b(design tokens?|tailwind|component library|storybook|responsive|flexbox|grid layout|navbar|react component|css variables?|dark mode|media quer|animation (code|css)|html prototype|front-?end|from figma|figma to (code|react|html))\w*/gi,
  data: /\b(spreadsheet|csv|pivot table|excel formula|pandas|dashboard metrics|data analysis)\w*/gi,
  ideation: /\b(brainstorm|come up with|generate ideas|name ideas|concept directions)\w*/gi,
  agentic: /\b(multi-?step|agentic|autonomous agent|automate (this|the|my)|end-to-end workflow)\w*/gi,
  longdoc: /\b(long document|entire (report|book|contract|codebase)|hundreds of pages|\d{2,} pages)\w*/gi,
  translation: /\b(translate|locali[sz]e|into (spanish|french|german|japanese|chinese|portuguese|italian))\w*/gi};
// Specific types come first in KW, so a tie goes to the more specific one
function detectTask(t) {
  let best = null, n = 0;
  for (const k in KW) {
    let sc = (t.match(new RegExp(KW[k].source, "gi")) || []).length;
    if (KW_STRONG[k]) sc += 3 * (t.match(KW_STRONG[k]) || []).length;
    if (sc > n) { n = sc; best = k; }
  }
  return best;
}
let taskManual = false;
const state = () => ({
  task: $("task").value, slider: +$("slider").value / 100,
  inTok: 0, outTok: 0, volume: 0,
  minCtx: 0, needVision: false, ignore: false});

// ---------- data ----------
async function getJSON(url, ms = 8000) {
  if (window.__EMBED && window.__EMBED[url]) return window.__EMBED[url];
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, {signal: c.signal}); if (!r.ok) throw new Error(r.status); return await r.json(); }
  finally { clearTimeout(t); }
}
function readCache() { try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch { return null; } }
async function loadRaw(force) {
  const cache = readCache();
  if (!force && cache && Date.now() - cache.t < TTL) return {data: cache.data, src: `cached live data (${ago(cache.t)})`};
  try {
    const j = await getJSON(API);
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({t: Date.now(), data: j})); } catch {}
    return {data: j, src: "live OpenRouter data (just now)"};
  } catch {}
  if (cache) return {data: cache.data, src: `stale cached data (${ago(cache.t)}); live fetch failed`};
  const snap = await getJSON("models-snapshot.json");
  return {data: snap, src: "offline snapshot (live fetch failed; prices may be outdated)"};
}
const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 60 ? `${m} min ago` : `${(m / 60).toFixed(1)} h ago`; };
function tierFor(blended) { return blended >= 10 ? "flagship" : blended >= 1 ? "balanced" : "fast-cheap"; }
function build(raw, curated) {
  return (raw.data || []).map(m => {
    const pIn = parseFloat(m.pricing?.prompt) * 1e6, pOut = parseFloat(m.pricing?.completion) * 1e6;
    if (!(pIn >= 0) || !(pOut >= 0) || !m.context_length) return null; // skips dynamic/unpriced routers
    const vision = (m.architecture?.input_modalities || []).includes("image");
    const c = curated[m.id], blended = (3 * pIn + pOut) / 4;
    const tier = c?.tier || tierFor(blended);
    const base = HEUR[tier];
    const ratings = {};
    RK.forEach(k => ratings[k] = c?.ratings?.[k] ?? (k === "vision" ? (vision ? base.vision : 0) : base[k]));
    if (!vision) ratings.vision = 0;
    for (const b in BLEND) ratings[b] = Math.round(10 * Object.entries(BLEND[b]).reduce((s, [k, w]) => s + w * ratings[k], 0)) / 10;
    return {id: m.id, name: m.name || m.id, ctx: m.context_length, pIn, pOut, blended, vision, tier, ratings,
      mult: c?.mult ?? null, notes: c?.notes || "", rated: !!c};
  }).filter(Boolean);
}
async function init(force) {
  $("status").textContent = "Loading models…";
  let curated = {};
  try { curated = (await getJSON("models-curated.json")).models || {}; }
  catch { $("status").textContent = "Could not load models-curated.json (opened via file://? use `python3 -m http.server`). Using heuristic ratings."; }
  try { const g = await getJSON("github-models.json"); g.data.forEach(m => curated[m.id] = {mult: m._multiplier, tier: m._tier, ratings: m._ratings, notes: m._notes}); ghModels = build(g, curated).map(m => ({...m, gh: true, rated: true})); } catch {}
  try { const r = await getJSON("reddit-signals.json"); signals = r.models || {}; sigDate = r.fetched; } catch {}
  try { const r = await getJSON("vendor-releases.json"); vendorRel = r; } catch {}
  try { forumSig = await getJSON("forum-signals.json"); } catch {}
  try {
    const {data, src} = await loadRaw(force);
    const ids = new Set(ghModels.map(m => m.id));
    models = ghModels.concat(build(data, curated).filter(m => !ids.has(m.id)));
    source = src;
    const rated = models.filter(m => m.rated).length;
    $("footer").textContent = `${models.length} models · ${rated} with curated ratings · source: ${src}`;
    if (!$("status").textContent.startsWith("Could")) $("status").textContent = "";
  } catch (e) { $("status").textContent = "Failed to load any model data: " + e.message; return; }
  render();
}

// ---------- scoring ----------
const fmt = n => n >= 1e9 ? (n / 1e9).toFixed(1) + "B" : n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? (n / 1e3).toFixed(n < 1e4 ? 1 : 0) + "K" : String(Math.round(n));
const usd = n => n === 0 ? "$0" : n < 0.01 ? "$" + n.toFixed(4) : n < 100 ? "$" + n.toFixed(2) : "$" + Math.round(n).toLocaleString();
function quality(m, task) {
  const t = m.ratings[task] || 0, s = m.ratings.speed;
  return task === "speed" ? t / 5 : (0.85 * t + 0.15 * s) / 5;
}
function recommend(s) {
  const tokens = s.inTok + s.outTok, hasTok = tokens > 0;
  let c = pool().filter(m => m.ctx >= s.minCtx && m.ctx >= tokens && (!(s.needVision || s.task === "vision") || m.vision) && m.ratings[s.task] > 0);
  if (!c.length) return {c, hasTok, tokens};
  c.forEach(m => {
    m.q = quality(m, s.task);
    m.ctxPct = hasTok ? tokens / m.ctx : 0;
    m.reqCost = hasTok ? (s.inTok * m.pIn + s.outTok * m.pOut) / 1e6 : null;
    m.basis = hasTok ? m.reqCost : m.blended;
    m.eff = m.q * (0.7 + 0.3 * m.ratings.speed / 5) / (1 + m.ctxPct);
  });
  const lp = c.map(m => Math.log(m.basis + 1e-9)), lo = Math.min(...lp), hi = Math.max(...lp);
  c.forEach((m, i) => m.costScore = hi > lo ? 1 - (lp[i] - lo) / (hi - lo) : 1);
  c.forEach(m => { const qs = c.map(x => x.q); const a = Math.min(...qs), b = Math.max(...qs); m.qn = b > a ? (m.q - a) / (b - a) : 1; });
  const srt = [...c].sort((x, y) => y.q - x.q || y.costScore - x.costScore);
  const fr = []; let bc = -1;
  srt.forEach(m => { m.front = m.costScore > bc + 1e-9; if (m.front) { fr.push(m); bc = m.costScore; } });
  fr.forEach((m, i) => m.pos = fr.length > 1 ? i / (fr.length - 1) : 0);
  c.forEach(m => { if (!m.front) { const n = fr.reduce((a, f) => Math.abs(f.costScore - m.costScore) < Math.abs(a.costScore - m.costScore) ? f : a); m.pos = n.pos; } });
  const maxEff = Math.max(...c.map(m => m.eff));
  c.forEach(m => m.effRel = Math.round(100 * m.eff / maxEff));
  return {c, hasTok, tokens};
}
const buzz = m => {
  const f = forumSig && forumSig.models, r = signals;
  const n = id => ((f && f[id] && f[id].mentions) || 0) + ((r && r[id] && r[id].mentions) || 0);
  const mx = Math.max(1, ...models.filter(x => x.gh).map(x => n(x.id)));
  return Math.min(1, n(m.id) / mx);
};
const scoreWith = (m, w) => {
  if (w <= 0.03) return m.q * 1e3 + m.costScore;
  if (w >= 0.97) return m.costScore * 1e3 + m.q;
  const k = (w - 0.03) / 0.94;
  return -Math.abs(m.pos - k) - (m.front ? 0 : 0.15) + m.qn * 0.01 + buzz(m) * 0.3;
};
const best = (arr, f) => arr.reduce((a, b) => (f(b) > f(a) || (f(b) === f(a) && b.ctx > a.ctx)) ? b : a);

let signals = {}, sigDate = null, vendorRel = null, forumSig = null;
// ---------- recommender ----------
function card(label, m, s, hasTok) {
  const rows = [["Quality fit", `${(m.q * 5).toFixed(1)} / 5 ${m.rated ? "" : "<span class=badge>heuristic</span>"}`], ["Tier", m.tier], ["Context", fmt(m.ctx)]];
  if (hasTok) {
    rows.push(["Context used", `${(m.ctxPct * 100).toFixed(m.ctxPct < .01 ? 2 : 1)}%<div class="bar ${m.ctxPct > .7 ? "hot" : ""}"><i style="width:${Math.min(100, m.ctxPct * 100)}%"></i></div>`]);
  }
  const mu = m.mult;
  rows.push(["Premium requests", mu != null ? `${mu}× per prompt <span class=badge>GitHub docs, legacy plans</span>` : "<span class=badge>not published</span>"]);
  const vv = vendorRel && vendorRel.vendors && vendorRel.vendors[m.id.split("/")[0]];
  if (vv) {
    const safe = u => /^https:\/\//.test(u) ? u : "#";
    const its = (vv.items || []).slice(0, 2).map(i => `<a href="${esc(safe(i.url))}" target="_blank" rel="noopener">${esc(i.title)}</a>`).join("<br>");
    rows.push(["Latest from vendor", (its || "") + `${its ? "<br>" : ""}<a href="${esc(safe(vv.url))}" target="_blank" rel="noopener">All news &amp; docs →</a>` + (vendorRel.fetched ? ` <span class=badge>${esc(vendorRel.fetched)}</span>` : "")]);
  }
  const sg = signals[m.id];
  if (sg && sg.threads && sg.threads.length) {
    const esc = x => x.replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
    rows.push(["Reddit chatter", sg.threads.map(t => `<a href="${t.url}" target="_blank" rel="noopener">${esc(t.title.slice(0, 80))}</a> <span class=badge>r/${t.sub} · ${t.score}↑</span>`).join("<br>") + `<br><span class=badge>${sigDate}</span>`]);
  }
  const fs = forumSig && forumSig.models && forumSig.models[m.id];
  if (fs && fs.threads && fs.threads.length) {
    rows.push(["Forum chatter", fs.threads.filter(t => /^https:/.test(t.url)).map(t => `<a href="${esc(t.url)}" target="_blank" rel="noopener">${esc(t.title.slice(0, 80))}</a> <span class=badge>${esc(t.src)} · ${+t.score || 0}↑</span>`).join("<br>") + (forumSig.fetched ? `<br><span class=badge>${esc(forumSig.fetched)}</span>` : "")]);
  }
  rows.push(["Usage efficiency", `${m.effRel}/100<div class="bar"><i style="width:${m.effRel}%"></i></div>`]);
  if (!s.ignore) {
    rows.push(["Price / 1M tokens", `${usd(m.pIn)} in · ${usd(m.pOut)} out`]);
    if (hasTok) {
      rows.push(["Per request", usd(m.reqCost)]);
      if (s.volume) rows.push(["Per month", usd(m.reqCost * s.volume)]);
    }
  }
  return `<div class="card"><div class="label">${label}</div><h3>${esc(m.name)}</h3><div class="hint">${esc(m.id)}</div>
  <dl>${rows.map(r => `<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join("")}</dl><p>${esc(m.notes)}</p></div>`;
}
function renderRecommender() {
  const s = state(), {c, hasTok, tokens} = recommend(s);
  $("slider").style.setProperty("--p", $("slider").value + "%");
  const v = s.slider, lab = v <= 0.03 ? "Pure quality: best model regardless of price" : v >= 0.97 ? "Pure cost: cheapest capable model" : v < 0.4 ? "Quality-leaning" : v <= 0.6 ? "Balanced" : "Cost-leaning";
  $("modeHint").textContent = lab + (hasTok ? "" : ". Prices shown per 1M tokens.");
  // usage panel
  const perMonth = tokens * s.volume;
  $("usage").innerHTML = "";
  if (!c.length) { $("results").innerHTML = `<div class="panel">No models match these constraints. No models have a rating for this task.</div>`; return; }
  const wo = s.slider;
  const overall = best(c, m => scoreWith(m, wo));
  const cards = [card(wo <= 0.03 ? "Best quality (cost ignored)" : wo >= 0.97 ? "Cheapest (quality ignored)" : "Best overall", overall, s, hasTok)];
  if (s.ignore) {
    cards.push(card("Most usage-efficient", best(c, m => m.eff), s, hasTok));
    const ok = c.filter(m => m.ratings[s.task] >= 3);
    if (ok.length) cards.push(card("Fastest acceptable", best(ok, m => m.ratings.speed * 10 + m.q), s, hasTok));
  } else {
    cards.push(card("Best value (balanced)", best(c, m => scoreWith(m, 0.5)), s, hasTok));
    const ok = c.filter(m => m.ratings[s.task] >= 3);
    if (ok.length) cards.push(card("Cheapest acceptable", best(ok, m => -m.basis * 1e6 + m.q), s, hasTok));
  }
  const w = s.slider;
  const top = [...c].sort((a, b) => scoreWith(b, w) - scoreWith(a, w) || b.ctx - a.ctx).slice(0, 10);
  $("results").innerHTML = `<div class="cards">${cards.join("")}</div>
  <h3 style="margin-top:1rem">Top 10 for your settings</h3><div class="table-wrap"><table><thead><tr><th>#</th><th>Model</th><th>Quality</th>${hasTok ? "<th class=n>Context used</th>" : ""}<th class=n>Efficiency</th>${s.ignore ? "" : `<th class=n>${hasTok ? "Per request" : "$/1M (blended)"}</th>${hasTok && s.volume ? "<th class=n>Per month</th>" : ""}`}</tr></thead><tbody>
  ${top.map((m, i) => `<tr><td>${i + 1}</td><td>${esc(m.name)}${m.rated ? "" : " <span class=badge>heuristic</span>"}</td><td>${(m.q * 5).toFixed(1)}</td>${hasTok ? `<td class=n>${(m.ctxPct * 100).toFixed(2)}%</td>` : ""}<td class=n>${m.effRel}</td>${s.ignore ? "" : `<td class=n>${usd(m.basis)}</td>${hasTok && s.volume ? `<td class=n>${usd(m.reqCost * s.volume)}</td>` : ""}`}</tr>`).join("")}
  </tbody></table></div>`;
}

// ---------- dashboard ----------
const COLS = [
  ["name","Model"],["tier","Tier"],["ctx","Context",1],["pIn","In $/1M",1,"$"],["pOut","Out $/1M",1,"$"],
  ...RK.map(k => ["r_" + k, TASK_LABEL[k], 1]), ["rated","Rated"]];
const val = (m, k) => k.startsWith("r_") ? m.ratings[k.slice(2)] : k === "rated" ? +m.rated : m[k];
function renderDashboard() {
  const ign = false, q = $("q").value.toLowerCase(), tf = $("tierFilter").value;
  let rows = pool().filter(m => (!q || (m.name + m.id).toLowerCase().includes(q)) && (!tf || m.tier === tf) && (!$("fVision").checked || m.vision) && (!$("fRated").checked || m.rated));
  rows.sort((a, b) => { const x = val(a, sortKey), y = val(b, sortKey); return (typeof x === "string" ? x.localeCompare(y) : x - y) * sortDir; });
  const cols = COLS.filter(c => !(ign && c[3] === "$"));
  $("table").innerHTML = `<thead><tr><th></th>${cols.map(c => `<th data-k="${c[0]}" class="${c[2] ? "n" : ""}">${c[1]}${sortKey === c[0] ? (sortDir > 0 ? " ▲" : " ▼") : ""}</th>`).join("")}</tr></thead><tbody>
  ${rows.slice(0, 500).map(m => `<tr><td><input type=checkbox data-id="${esc(m.id)}" ${selected.has(m.id) ? "checked" : ""}></td>${cols.map(c => {
    const v = val(m, c[0]);
    return `<td class="${c[2] ? "n" : ""}">${c[0] === "name" ? `${esc(m.name)}<div class=hint>${esc(m.id)}</div>` : c[0] === "ctx" ? fmt(v) : c[3] ? usd(v) : c[0] === "rated" ? (v ? "✓" : "–") : v}</td>`; }).join("")}</tr>`).join("")}</tbody>`;
  $("cmpCount").textContent = selected.size;
}
function renderCompare() {
  const ms = models.filter(m => selected.has(m.id)), ign = false;
  if (ms.length < 2) { $("compare").innerHTML = `<div class="panel">Select at least two models to compare.</div>`; return; }
  const rows = [["Tier", m => m.tier], ["Context", m => fmt(m.ctx)], ["Vision", m => m.vision ? "yes" : "no"],
    ...(ign ? [] : [["Input $/1M", m => usd(m.pIn)], ["Output $/1M", m => usd(m.pOut)]]),
    ...RK.map(k => [TASK_LABEL[k], m => m.ratings[k]]), ["Notes", m => esc(m.notes)]];
  $("compare").innerHTML = `<div class="table-wrap" style="margin-bottom:1rem"><table><thead><tr><th></th>${ms.map(m => `<th>${esc(m.name)}</th>`).join("")}</tr></thead><tbody>
  ${rows.map(r => `<tr><th>${r[0]}</th>${ms.map(m => `<td style="white-space:normal">${r[1](m)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const pool = () => models.filter(m => m.gh);
function render() { renderRecommender(); renderDashboard(); }

// ---------- events ----------
document.querySelectorAll("#tabs button").forEach(b => b.onclick = () => {
  document.querySelectorAll("#tabs button").forEach(x => x.classList.toggle("active", x === b));
  document.querySelectorAll(".view").forEach(v => v.hidden = v.id !== "view-" + b.dataset.view);
});
$("task").addEventListener("change", () => { taskManual = true; $("prompt").dispatchEvent(new Event("input")); });
$("prompt").addEventListener("input", () => {
  const t = $("prompt").value.trim(), hit = t && detectTask(t), k = t && (hit || "reasoning");
  if (!taskManual && k) $("task").value = k;
  $("detected").textContent = !t ? "Type a prompt and I'll detect the task type."
    : (hit ? "Detected: " : "No clear match, using general: ") + TASK_LABEL[k] + (taskManual ? " (set manually)" : "") + (hit ? "" : " — pick another in Task type.");
  renderRecommender();
});
["task","slider"].forEach(id => $(id).addEventListener("input", renderRecommender));
["q","tierFilter","fVision","fRated"].forEach(id => $(id).addEventListener("input", renderDashboard));
$("table").addEventListener("click", e => {
  const th = e.target.closest("th[data-k]");
  if (th) { sortDir = sortKey === th.dataset.k ? -sortDir : (th.dataset.k === "name" || th.dataset.k === "tier" ? 1 : -1); sortKey = th.dataset.k; renderDashboard(); }
  if (e.target.matches("input[data-id]")) { const id = e.target.dataset.id; e.target.checked ? selected.add(id) : selected.delete(id); $("cmpCount").textContent = selected.size; }
});
$("compareBtn").onclick = renderCompare;
$("refresh").onclick = async () => { $("refresh").disabled = true; await init(true); $("refresh").disabled = false; };
const setTheme = t => { document.documentElement.dataset.theme = t; localStorage.setItem("modelPicker.theme", t); };
$("theme").onclick = () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
setTheme(localStorage.getItem("modelPicker.theme") || "dark");
init(false);
})();
