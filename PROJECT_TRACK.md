# PROJECT TRACK — HYDRA (Into the Scrape-Verse Hackathon)

> **READ THIS FILE FIRST, EVERY SESSION.** Single source of truth for this project.
> Any AI or human resuming work: read top to bottom, check STATUS + RUNTIME STATE + PROGRESS LOG + NEXT ACTIONS, then continue.
> **After every work session: append to PROGRESS LOG, update NEXT ACTIONS. Never skip this.**

---

## 1. ONE-PARAGRAPH SUMMARY

We are building **HYDRA** — a self-healing web-data platform for **Into the Scrape-Verse**
(WeMakeDevs × Bright Data, Aug 17–23 2026). HYDRA monitors **AI-hardware/GPU prices** across
multiple stores using custom scrapers built in **Bright Data Scraper Studio** (mandatory).
A **Watchdog engine** validates every scrape run (schema, null-rates, row counts, freshness);
when a store redesigns and the scraper breaks, the watchdog automatically runs the **self-heal
loop** (Bright Data AI Flow API: `refactor_template` → poll → `resume_automation_job` approve →
re-run → verify), repairing the scraper with zero human touch, and the data keeps flowing.
A hosted **Chaos Engine** (our own demo store we redesign on demand) proves live, on camera,
that breakage → detection → repair → recovery works. Output powers a polished Next.js
dashboard: price histories, cross-store comparison, deal alerts, and a collector-health
timeline with full heal receipts.

**Why this wins:** 6 equally-weighted judging criteria; HYDRA maxes all six and competes for
all 3 tracks at once (Web-Slinger grand prize, Suit-Up UI, Spider-Sense clean code).
Differentiator: everyone else will *claim* self-healing; we will *demo it live* by breaking a
site mid-presentation and letting HYDRA repair itself.

---

## 2. HACKATHON FACTS (verified 2026-08-14)

| Item | Value |
|---|---|
| Event | https://www.wemakedevs.org/hackathons/scrape-verse (+ /rules /schedule /resources) |
| Dates | **Aug 17–23, 2026** · submissions close Aug 23 · winners early Sept |
| Mode | Online, **solo** · registered ✅ |
| Credits | $50 promo `wemakedevs` (lowercase, billing section) ✅ + free tier 5,000 credits/mo |
| Prize target | Web-Slinger: NVIDIA DGX Spark or $5,000 |

### Rules that shape the build
1. **Must** use Scraper Studio to create & run a **custom** scraper (pre-built library alone = DQ).
2. Public data only — no login/paywalled/personal data.
3. **Main coding/design work begins after Aug 17 kickoff.** Before: ideas, notes, architecture, diagrams only. **No production code, no project collectors before kickoff.** (Light CLI smoke-test on a throwaway URL to learn the tool = acceptable learning, like reading docs; nothing project-specific.)
4. Submission: public repo, clear README, example structured output, **demo video**, Scraper Studio usage explanation.
5. AI coding tools allowed, **must be disclosed**; user must understand and be able to explain all code.
6. One team per participant.

### FAQ & page insights (studied 2026-08-14 — each with action item)
| FAQ / page detail | What it means for us | Action |
|---|---|---|
| "Scraper Studio mandatory — every eligible project" | Confirmed core constraint | HYDRA built around it ✅ |
| **"Run out [of credits] before you ship and we'll top you up"** | Organizers will top up credits by email — zero credit anxiety | If budget red: email contact@wemakedevs.org |
| **Submission form "goes up on this page before the deadline — check back and file while it's open"** | Form NOT live yet; must watch for it during the week | **Check hackathon page + Discord DAILY from Aug 20**; submit as soon as form opens |
| Submission needs: repo, demo video, description, how Studio was used | Exact deliverables list | All 4 in plan (§6–7) ✅ |
| All submissions auto-considered for **all 3 tracks** | Our 3-track sweep costs nothing extra | Confirmed strategy ✅ |
| AI tools allowed BUT "must understand the project, verify generated code, explain technical decisions" + rules require disclosure | User must genuinely own the knowledge — judges can probe | **"Understanding review" session Day 6–7: walk user through every component**; README gets AI-use disclosure |
| Public web data only; no private/login/paywalled | Chaos store (ours) + public category pages = compliant | Avoid ToS-hostile targets when vetting stores |
| Raffle: every registration enters, no project needed | Already in the helmet draw via registration | Nothing to do |
| Grand prize team chooses DGX Spark **or $5,000 cash** | If we win: user's choice, solo = full prize either way | Note for later |
| **Swag for ten: share build on socials, tag @WeMakeDevs** | Free visibility + swag lottery; also signals community engagement judges/orgs like | Post build updates on X/socials tagging WeMakeDevs (≥2 posts: mid-week + demo video) |
| Ideas list includes "Scraper health monitor" + "price intelligence" | HYDRA = TWO of their six suggested ideas fused — on-brief, but others may build watchdogs too | Differentiator stays: live chaos demo + product polish + coding-agent-driven flow |
| "The demo is scored as hard as the code" | Presentation = 1/6 weight and gates everything else | Rehearse demo script; polish dashboard visuals |
| $2,500 Bright Data credits split across top teams | Bonus prize | — |
| SF Aug 22 "Zero Downtime Hackathon" (in-person twin event) | N/A for remote, but same sponsor/judges pool — awareness only | — |

### Judging criteria (equal weight) → HYDRA's answer
| Criterion | HYDRA's answer |
|---|---|
| Potential impact | GPU price transparency across stores; watchdog is a reusable ops layer for ANY Scraper Studio user |
| Creativity | Autonomous repair loop + Chaos Engine that breaks sites on demand |
| Technical excellence | TS monorepo, typed pipeline, validators, event-sourced heal timeline, tests |
| Use of Scraper Studio | Custom collectors, built + healed via AI Flow, run via Collection API; whole flow driven from coding agent |
| Reliability & self-healing | Detect → diagnose → heal → verify with receipts; serialized heal queue; retry policy |
| Presentation | Live chaos demo script; finished-looking dashboard; README with diagrams |

### Grand-prize arc (what judges look for)
designed in Scraper Studio → driven from coding agent → what it did when the site changed → what the output powered.

---

## 3. FINAL DECISIONS (locked with user, 2026-08-14)

| Decision | Choice |
|---|---|
| Concept | **HYDRA** — self-healing data platform |
| Domain | GPU/AI-hardware prices |
| Team | Solo + AI agents |
| Stack | TypeScript end-to-end: Next.js (App Router) + Tailwind; Node/TS worker; SQLite + Drizzle ORM; Bright Data CLI + REST API; Vercel (web + chaos store) + Railway/Fly or local+ngrok (worker) |
| Repo | Monorepo `D:\Scrape-Verse\hydra`, `git init` on Aug 17 |
| Auth | **None** (decided 08-15): public dashboard, no login wall for judges; alert rules via localStorage. Vercel Hobby = dashboard + chaos store; worker separate (30-min cadence impossible on Vercel free cron; SQLite non-persistent there) — web fetches from worker API. Clerk deferred to post-hackathon |

---

## 4. TOOL DEEP-DIVE (researched 2026-08-14 — study before coding)

### 4.1 Bright Data CLI (`@brightdata/cli`, commands `brightdata`/`bdata`, ≥v0.3.1 for heal)

```bash
# Auth
bdata login                     # browser OAuth; auto-creates zones cli_unlocker + cli_browser; stores API key locally
bdata login --device            # headless/SSH device flow
bdata login --api-key <key>     # or direct key
export BRIGHTDATA_API_KEY=...   # env var for headless/CI (worker uses this)

# Scraper Studio (our core)
bdata scraper create <url> "<one-sentence field description>"   # AI builds scraper → Collector ID c_* (5–15 min, up to 25)
bdata scraper run <c_id> [url] --pretty                         # realtime first → auto-fallback to batch; -o file
bdata scraper heal <c_id> "<what broke, <1000 chars>" --url <url>  # → status awaiting_approval + preview_result
bdata scraper approve <c_id> --url <url>                        # commit fix; --reject to discard; keep same c_id
#   heal flags: --auto-approve (unattended, polls to done), --timeout 600, --max-retries 4 (429 concurrent-AI-job cap), --no-retry

# Useful extras
bdata status <s_id> --wait      # async snapshot job status
bdata budget / budget zones     # credit balance + per-zone spend (credit telemetry!)
bdata add mcp --agent claude-code --global   # Bright Data MCP server for agent (scrape_as_markdown, search_engine, …)
bdata skill add                 # agent skills: search, scrape, data-feeds, bright-data-mcp, bright-data-best-practices
npx -p @brightdata/cli bdata …  # npx on demand (docs' recommended pattern inside coding agents)
```

### 4.2 Collection API (run scrapers from code — what hydra-core worker uses)

Base `https://api.brightdata.com`, `Authorization: Bearer <API token>` (from Account Settings → API Tokens).

| Call | Request | Response / behavior |
|---|---|---|
| Trigger batch | `POST /dca/trigger?collector=<c_id>&queue_next=1` body `[{url}, …]` (must match collector input schema; default `{url}`; else 422) | `{"collection_id": "j_…"}` (= snapshot_id everywhere else). `queue_next=1` runs now |
| Poll results | `GET /dca/dataset?id=<j_id>` every 5 s | **202 `{status:"building"}`** while running → **200 `[rows]`** when ready (same endpoint). Each row carries `input` echo |
| Realtime | `POST /dca/trigger_immediate` + `GET /dca/get_result` | small inputs only; CLI uses this first |
| Rerun failed | Runs tab → Rerun job (or rerun-job API `failed_only`) | only unexpired data |

IDs: **Collector `c_*`** = scraper definition (stable across heals) · **Collection `j_*`** = one run.
Timing: 1–10 inputs ≈ 30–90 s; 11–100 ≈ 2–5 min. Errors: 401 token, 404 collector, 422 input schema, 5xx backoff 1s/2s/4s.

### 4.3 AI Flow API (create + self-heal scrapers)

**Workflow 1 — create:** `POST /dca/collector` → `POST /dca/collectors/{c}/automate_template` → poll progress. Stages: `user_intent_analyzer → planner → collector_maintainer → output_schema_generator → code_generator → input_schema_generator → preview_runner → preview_picker`.

**Workflow 2 — self-heal (the heart of HYDRA):**
1. `POST /dca/collectors/{c_id}/refactor_template` body `{"prompt": "<≤1000 chars>", "custom_input": [<optional urls>]}`
2. Poll `GET /dca/collectors/{c_id}/refactor_template/progress` → `{status, step, progress, id, completed_steps, preview_result[], diff}`. Terminal: done-family (`ready/done/completed/success/finished`), fail-family (`failed/error/cancelled`), or **`status:"pending_answer"` + `step:"user_approval"`** = approval gate with candidate `preview_result`
3. `POST /dca/collectors/{c_id}/resume_automation_job` body `{"message": true, "auto_save": true}` → approves + auto-saves template on success (`message:false` = reject). *(This endpoint postdates the official demo repo, which exits code 3 at the gate — we can fully automate.)*
4. Re-trigger collection → verify rows healthy.

**Constraints:** AI jobs (create AND heal) hit a **concurrent cap → 429**; serialize all heal/create calls globally (one at a time per account); CLI retries with `--max-retries`. Heal prompt ≤ 1000 chars. Heal can take up to ~15 min.

Reference implementation studied: `anil-bd/scraper-studio-self-healing-demo` (health-check heuristic: rows exist + REQUIRED_FIELDS non-empty per row; 202/200 dataset pattern; exit codes 0 healthy/healed, 2 still broken, 3 awaiting approval). Node starters: `brightdata/bright-data-scraper-studio-nodejs-project` (retry/backoff template).

### 4.4 Scraper Studio essentials

- **3 build surfaces**, same output: AI Agent (dashboard chat), IDE (JS editor + Self-Healing panel + Versions rollback), CLI (same AI flow from terminal). Scraper started in one opens in others.
- **Five scraper types** (AI Agent picks): PDP (N urls → N rows, 1 page/input), **Discovery (category url → N listing rows, 1 page/input — our choice, cheapest)**, Discovery+PDP (1+N — expensive, avoid), Search (keyword), Sitemap (1+N). Not a crawler — scope each scraper to one data shape.
- **Worker types:** **Code worker** = raw HTTP, fast/cheap, no JS/clicks (static HTML, sitemaps, JSON APIs). **Browser worker** = headless browser, JS + clicks + `tag_response` network capture, slower/costlier. Switchable per scraper or per stage. **Chaos store → static HTML → Code worker (≈1 page-load per test). Real stores → whatever AI picks; prefer Code if data in raw HTML.**
- **Best practices** (for IDE edits): combine selectors in one `el_exists`; paginate via `rerun_stage` fan-out from root page (parallel-friendly); 16 MB/session result cap → one page per session; `close_popup()` background watcher; `tag_response()` + `wait_for_parser_value()` for API capture; default 30 s waits (max 60); no custom retry loops (platform retries with fresh peer); `?.`/`??` not try/catch; `toArray().map()`; `.text_sane()`.
- **Self-healing in UI:** plain-language prompt → diff in draft → preview → Update Schema → Save to Production; Versions menu for rollback. Same capability via API (above).
- **Specs/limits:** billing = CPM per 1,000 page loads (a `navigate/request/load_more` = 1 load; records ≠ loads); file downloads per GB; 100 parallel batch jobs/scraper (rest queue); 50 K realtime req/min; **retention: batch 16 d, realtime 7 d → ingest to our SQLite immediately**.

### 4.5 Coding-agent integration (grand-prize arc #2)

- Docs' canonical pattern: run CLI through `npx -p @brightdata/cli` inside the agent; agent isn't building the scraper — it drives Bright Data's AI.
- Pin collector IDs in rules file (we'll put them in `.claude/settings.json` / CLAUDE.md + `.env`): `SCRAPER_STUDIO_COLLECTOR_ID=…` + usage strings.
- Docs provide copy-paste prompts: build-and-run (3 steps) and build-run-heal-approve-verify (6 steps). Our repo README will mirror this to show "driven from your coding agent".
- Optional: `bdata add mcp` gives agent extra tools (scrape_as_markdown, search_engine).

### 4.6 Credit budget (recalculated — much cheaper than v1)

Discovery scrapers ≈ 1–5 page loads per run. Plan: 4 collectors × 4 runs/day × 6 days ≈ 100 runs ≈ 300–500 page loads total + heal re-runs (~30) + creation previews. Comfortably inside free tier + $50. Track daily via `bdata budget` → log to health page (nice transparency touch). Escalation if ever tight: drop real-store cadence to 2/day (email contact@wemakedevs.org for top-up).

---

## 5. ARCHITECTURE (v2 — informed by research)

```
┌────────────────────────┐      ┌───────────────────────────────┐
│ REAL STORES (3)        │      │ CHAOS STORE (we host, Vercel) │
│ GPU category pages,    │      │ static HTML, ~20 fake GPUs,   │
│ Discovery scrapers     │      │ layouts v1/v2/v3, Code worker │
└──────────┬─────────────┘      └───────────────┬───────────────┘
           │ Bright Data proxy/unblock          │
           ▼                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ BRIGHT DATA SCRAPER STUDIO — 4 custom collectors (c_* ids)      │
└──────────┬──────────────────────────────────────┬───────────────┘
           │ Collection API (trigger/dataset)     │ AI Flow API (refactor/resume)
           ▼                                      ▼
┌─────────────────────────────────────────────────────────────────┐
│ HYDRA-CORE (Node/TS worker, BRIGHTDATA_API_KEY env)             │
│  Scheduler ── Ingest ── Validate(zod+heuristics) ── Watchdog    │
│  HealQueue (GLOBAL SERIAL — 429 cap: one AI job at a time)      │
│  HealOrchestrator: diagnose → refactor_template → poll →        │
│    resume_automation_job(auto_save) → re-run → verify           │
│  IncidentLog (event-sourced: every step timestamped)            │
│  SQLite (WAL) — collectors, runs, rows, prices, incidents,      │
│  heal_events, alerts. Ingest immediately (7/16d retention)      │
└──────────┬──────────────────────────────────────────────────────┘
           ▼  (read same DB / thin API)
┌─────────────────────────────────────────────────────────────────┐
│ HYDRA-WEB (Next.js, Vercel)                                     │
│  Overview: GPU price index, movers, best price per model        │
│  Product: per-GPU per-store history charts · Alerts feed        │
│  Health: collector cards, incident timeline, heal receipts      │
│  Chaos Lab: "Redesign store" button + SSE live heal stream      │
└─────────────────────────────────────────────────────────────────┘
```

### Repo layout (create Aug 17)
```
hydra/
  apps/web        # Next.js dashboard
  apps/worker     # hydra-core: scheduler, ingest, validators, watchdog, heal orchestrator
  packages/shared # types, zod schemas, config
  chaos-store/    # static store, 3 layout variants + switch script
  docs/           # architecture diagram, demo script, receipts
  PROJECT_TRACK.md (copy of this file) · README.md
```

### DB schema (design note — allowed pre-kickoff)
```
collectors(id, c_id, name, kind[real|chaos], worker_type, url, schema_json, created_at)
runs(id, collector_id, snapshot_id j_*, status, rows_in, null_rate, page_loads, started_at, finished_at)
prices(id, run_id, collector_id, gpu_model, product_name, price, currency, stock_status, url, scraped_at)
incidents(id, collector_id, type[null_burst|row_drop|schema_drift|stale|empty], severity, opened_at, closed_at, status)
heal_events(id, incident_id, step[diagnose|refactor|poll|approve|rerun|verify], status, detail_json, at)
alerts(id, gpu_model, kind[price_drop|restock], threshold, triggered_at, run_id)
```

### Validators (per collector, zod + heuristics)
- schema conformance (required fields non-null, correct types — REQUIRED_FIELDS pattern)
- null-rate: >30% rows missing required field → breach
- row-count: <50% of trailing 5-run median → breach
- freshness: no successful run in 2× schedule → breach
- price sanity: median drift >40% between runs → warn (avoid false heal triggers)

### Heal loop (exact implementation — §4.3 Workflow 2)
States: `detecting → diagnosing → healing(awaiting|running) → verifying → closed|failed(retry≤2)`.
Chaos collector: `auto_save: true` (unattended). Real collectors: approval-gated by default (human-in-loop safety) — configurable; demo shows both.

### Demo timing reality (from specs)
Heal takes minutes (AI refactor + preview). Demo plan: click redesign → SSE stream shows live steps while narrating architecture → verification completes on camera (rehearse; if >4 min, pre-warm a second incident or time-lapse receipts as backup).

---

## 6. BUILD PLAN (7 days, solo — hour-aware)

### Pre-kickoff (NOW → Aug 16) — allowed only
- [x] Research + strategy + this track file
- [ ] `npm install -g @brightdata/cli` ; `bdata login` ; verify zones + credits (`bdata budget`)
- [ ] Optional smoke-test on docs' HN example (learning the tool, not project code)
- [ ] Vet 4–5 candidate GPU category URLs (public, no login): Newegg, Micro Center, Scan, Mindfactory, Best Buy — record which render prices in raw HTML (Code-worker friendly)
- [ ] Re-read §4 of this file before Day 1

### Day 1 — Aug 17 (Mon): collectors + skeleton
- git init monorepo; scaffold apps/web, apps/worker, packages/shared, chaos-store
- **First action:** `bdata scraper create` × 2 real stores + chaos v1 (parallel submissions OK — they queue; watch 429) while scaffolding continues
- Ingest v0: trigger → poll dataset → write rows+run to SQLite; save c_ids to .env + RUNTIME STATE
- Chaos store v1 static HTML deployed (Vercel)

### Day 2 — Aug 18 (Tue): validation + scheduling
- zod schemas + 5 validators; scheduler (real: 6 h, chaos: 30 min); 3rd real collector
- Health API endpoints (worker → web); incident + heal_events tables live

### Day 3 — Aug 19 (Thu): heal loop E2E — **MILESTONE M1**
- HealOrchestrator + global serial HealQueue; chaos v2/v3 layouts + switch script
- **M1: flip chaos v1→v2; watchdog detects, heals unattended (auto_save), verifies, closes incident**
- Fallback if resume_automation_job misbehaves: CLI `heal --auto-approve` subprocess

### Day 4 — Aug 20 (Fri): dashboard
- Overview + product history (lightweight charts) + best-price + alerts; Health page with incident timeline + expandable receipts

### Day 5 — Aug 21 (Sat): chaos lab + hardening + deploy
- Chaos Lab page + SSE stream; nightly chaos cron (auto-break/heal, collect receipts)
- Deploy web (Vercel) + worker (Railway/Fly or local+ngrok); README + diagram; AI-use disclosure

### Day 6 — Aug 22 (Sun): demo video + polish
- Record ≤5 min demo (script §7); test on fresh machine; buffer for flakiness

### Day 7 — Aug 23 (Mon): **SUBMIT EARLY** (form + repo + video + description)

---

## 7. DEMO VIDEO SCRIPT (~4 min — the 4 arcs)
1. **Problem (30 s):** scrapers rot silently; show broken price field returning null.
2. **Studio + agent (60 s):** `bdata scraper create` in coding agent; schema + first JSON; pinned c_ids.
3. **Product (60 s):** dashboard — index, history, alert fires.
4. **THE MOMENT (90 s):** Chaos Lab → "Redesign store" → SSE: null-spike → incident → heal → approve → green. Zero rows lost downstream.
5. **Wrap (30 s):** architecture, receipts wall, "cut one head off, it grows back."

---

## 8. RISKS & MITIGATIONS
| Risk | Mitigation |
|---|---|
| 429 concurrent AI-job cap | Global serial HealQueue; backoff; `--max-retries` |
| Heal fails on drastic redesign | Chaos redesigns moderate (class renames, field moves, node wrapping); retry ≤2 with sharper prompt; keep honest failure receipts too |
| resume_automation_job unexpected | Fallback: subprocess `bdata scraper heal --auto-approve`; test Day 3 |
| Real store never breaks | Chaos engine carries the story; some stores genuinely drift (sold-out, A/B) |
| Store blocks/changes scrapeability | Bright Data unblocking; 1 backup store per slot vetted Day 1 |
| Heal latency in demo | Rehearse timings; SSE narration; pre-warmed backup incident; time-lapse receipts |
| Solo bandwidth | Scope frozen: 4 collectors, 5 pages, no extras |
| Rule 3 (early work) | No production code/collectors before Aug 17; this file = planning artifact |
| SQLite concurrent access | WAL mode; web reads via worker API where needed |

---

## 9. KEY LINKS
- Hackathon: https://www.wemakedevs.org/hackathons/scrape-verse (+/rules /schedule /resources)
- CLI tutorial: https://docs.brightdata.com/datasets/scraper-studio/build-with-the-cli · Commands: https://docs.brightdata.com/cli/commands
- API quickstart: https://docs.brightdata.com/datasets/scraper-studio/quickstart
- AI Flow overview: https://docs.brightdata.com/api-reference/scraper-studio-api/ai-flow/overview · Trigger heal: …/ai-flow/trigger-self-healing · Resume: …/ai-flow/resume-self-healing-job
- Self-Healing tool (UI): https://docs.brightdata.com/datasets/scraper-studio/self-healing-tool
- AI Agent (5 types): https://docs.brightdata.com/datasets/scraper-studio/ai-agent · Best practices: …/best-practices · Worker types: …/worker-types · Specs: …/specifications
- Coding-agent prompts: https://docs.brightdata.com/datasets/scraper-studio/coding-agent-prompts
- Demo repo (heal loop): https://github.com/anil-bd/scraper-studio-self-healing-demo · Node starter: https://github.com/brightdata/bright-data-scraper-studio-nodejs-project
- CLI repo: https://github.com/brightdata/cli · Skills: https://github.com/brightdata/skills
- Discord: https://discord.gg/xrF2PBr42A · Promo: `wemakedevs` in billing (lowercase)

---

## 10. HOW TO RESUME WORK (protocol for any AI/human)
1. Read this file completely.
2. Check STATUS, RUNTIME STATE, PROGRESS LOG, NEXT ACTIONS.
3. `git -C D:\Scrape-Verse\hydra status && git log --oneline -10` (once repo exists).
4. Do only the top NEXT ACTIONS; respect day plan + "no code before Aug 17".
5. Hard-update this file: STATUS, RUNTIME STATE, append PROGRESS LOG (date/done/decided/blocked), rewrite NEXT ACTIONS.
6. Never commit secrets: `.env` gitignored; API keys never in repo; Collector IDs may be public.

---

## 11. STATUS
- **Phase:** Pre-kickoff — tool research complete; plan v2 locked; awaiting Aug 17
- **Blocked:** Nothing
- **Repo:** not yet created (`D:\Scrape-Verse\hydra` on Aug 17; track file = `D:\Scrape-Verse\PROJECT_TRACK.md`)

## 12. RUNTIME STATE (live values — keep updated)
| Key | Value |
|---|---|
| CLI | ✅ installed v0.3.4 (has heal/approve), logged in, key stored, zones `cli_unlocker`+`cli_browser` auto-created |
| Balance | **$52.00** (verified via `bdata budget` after 5 test scrapes — vetting cost ≈ $0) |
| Collector real #1 | **Newegg** — `https://www.newegg.com/GPU-Devices/Category/ID-38` ✅ vetted: RTX/RX names + many $ prices in raw HTML (986KB) |
| Collector real #2 | **Micro Center** — `https://www.microcenter.com/category/4294966937/graphics-cards` ✅ vetted: RTX 5070 + $ prices (386KB) |
| Collector real #3 | **Mindfactory (DE)** — `https://www.mindfactory.de/Hardware/Grafikkarten.html` ✅ vetted: RX 9070 + € prices "255,25 €" format (230KB) |
| Collector chaos | — (create Day 1) |
| Chaos store URL | — (deploy Day 1) |
| Dashboard URL | — |
| Dropped candidates | Best Buy (client-side render, no prices in 620KB HTML) · Scan.co.uk (404 via unlocker) · all plain-curl fetches blocked (Cloudflare/Akamai) — proves unblocking value prop |
| Vetting artifacts | `D:\UserData\Temp\opencode\*_bd.html` (newegg/mc/mf unlocked HTML samples) |
| Local env (checked 08-14) | Node v24.12.0 ✅ · npm 11.8.0 ✅ · git 2.55.0 ✅ · gh CLI 2.97.0 ✅ · vercel CLI not installed (deploy via dashboard or `npm i -g vercel` later) |
| User TODOs before Aug 17 | 1) `gh auth login` (user runs personally) · 2) Vercel account via GitHub sign-in · 3) Copy Bright Data API token from Account Settings → paste into project `.env` when created (never in chat/repo) · 4) Join WeMakeDevs Discord (organizer answers during week) |

## 13. NEXT ACTIONS (top of stack)
1. ~~CLI install/login/budget~~ ✅ done 2026-08-14
2. ~~Vet store URLs~~ ✅ done 2026-08-14 (Newegg + Micro Center + Mindfactory locked)
3. (Optional) Skim §4 tool deep-dive once more before Day 1
4. **Aug 17 00:01: git init monorepo + launch `bdata scraper create` × 3 stores + chaos v1 FIRST (5–25 min each, run in background while scaffolding)**
5. From Aug 20: check hackathon page + WeMakeDevs Discord daily — submission form goes live before deadline; file as soon as it opens
6. During week: post build updates on socials tagging @WeMakeDevs (swag + visibility)
7. Day 6–7: user "understanding review" — user explains every component back to judge level (FAQ requirement)

## 14. PROGRESS LOG (append-only, newest last)
| # | Date | Entry |
|---|------|-------|
| 001 | 2026-08-14 | Researched hackathon site/rules/schedule/judging; studied Scraper Studio docs (CLI, self-heal UI+API); consulted user → locked HYDRA / GPU prices / solo / TS stack; created track file v1. |
| 002 | 2026-08-14 | Deep tool research: full CLI command reference; Collection API (trigger/dataset 202→200 pattern, IDs, timings, errors); AI Flow API (create stages, heal 3-call loop, resume_automation_job + auto_save); official self-healing demo repo source (health-check heuristic, exit codes, approval-gate history); specs (CPM per page load, 429 concurrent AI-job cap, retention 7/16d); worker types (Code vs Browser); AI Agent 5 scraper types (Discovery = cheapest); best practices (pagination fan-out, 16MB session, no retry loops); coding-agent prompts + MCP. Plan upgraded to v2: serial HealQueue, chaos store on Code worker, Discovery scrapers, recalculated credit budget (fits easily), heal-latency-aware demo plan. |
| 003 | 2026-08-14 | FAQ deep-dive (re-verified live, unchanged): extracted 14 insights → added submission-form monitoring (daily from Aug 20, form not yet live), socials posting task (swag+visibility, tag WeMakeDevs), user "understanding review" before submission (AI-use disclosure requirement), credits top-up escape hatch (email organizers), raffle auto-entry confirmed, noted HYDRA = fusion of 2 official suggested ideas (price intelligence + scraper health monitor). Track file §2 extended with FAQ insight table. |
| 004 | 2026-08-14 | Executed pre-kickoff setup: installed CLI v0.3.4; `bdata login` OK (zones auto-created); balance $52.00 verified. Vetted stores through Web Unlocker: Newegg ✅ (names+prices in HTML), Micro Center ✅, Mindfactory ✅ (€ prices) — locked as the 3 real collectors. Dropped Best Buy (JS-only render) + Scan (404). All plain-curl requests blocked by Cloudflare/Akamai — confirms Bright Data unblocking is essential. Vetting cost ≈ $0. Next: kickoff Aug 17. |
| 005 | 2026-08-15 | Workspace relocated: hackathon folder = D:\Scrape-Verse. PROJECT_TRACK.md moved here from D:\contra; all repo paths updated to D:\Scrape-Verse\hydra. Auth decision: none/public dashboard (Clerk deferred post-hackathon). |
