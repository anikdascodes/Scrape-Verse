# HYDRA — Demo Video Storyboard (~4 min, target 3:45)
> Recorded Aug 22 (or earlier for early submission). User narrates (rule 11).
> PRINCIPLES (from judge intel, NOTES_kickoff-live.md):
>   1) A judge sees a SCREEN within 90 seconds — no JSON blobs first.
>   2) The heal must be a REAL break-repair (layout redesign), never a "add a field" extension —
>      that is the "staged" tell judges look for.
>   3) No API tokens / .env ever visible on screen.
>   4) Collector IDs shown as proof of create-and-run.

## Shot 0 — Cold open (0:00–0:15) — "the rot"
- Screen: split — left: our dashboard healthy; right: terminal price field = null
- VO: "Scrapers don't crash when a site changes. They keep running — and quietly return nothing."
- Cut to title card: **HYDRA — cut one head off, it grows back.**

## Shot 1 — THE SCREEN FIRST (0:15–0:45) — dashboard teaser (judge sees the product, criteria 1+6)
- Screen: dashboard Overview grid — GPU cards with best price per store, EUR/USD side by side
- Quick click: RTX 5070 → multi-store price history chart
- VO: "HYDRA is a self-healing GPU price platform. Three stores, two currencies, one schema.
  Web prices collected by custom scrapers built on Bright Data Scraper Studio — and maintained
  by no one. The scrapers maintain themselves."

## Shot 2 — Studio + agent proof (0:45–1:20) — create-and-run with Collector ID (criterion 4)
- Screen: terminal in coding agent
- Type: `bdata scraper create https://www.newegg.com/... "Extract every GPU product…"`
- Show: AI stages live → **Collector ID c_mswxuxrc1k9tpskymz** → `scraper run` → JSON rows
- VO: "One sentence in, structured JSON out. Every store has its own collector — built by
  arranging, driven by console from my coding agent, wired into an API, a database, a
  scheduler, and this dashboard. Same Collector ID, from first run to every repair."

## Shot 3 — THE MOMENT (1:20–2:50) — real break → self-heal live (criteria 2, 5)
- Screen: /chaos Chaos Lab
- Click "🔥 Redesign store" → Voltmart flips layout v2→v3 in ~15s (show the store briefly!)
- Watch feed: `run failed · 0 rows` → `incident opened` → `refactor_template requested` →
  `AI regenerating…` → `approved` → `rerun` → `verified 20/20 rows` → `incident closed`
- VO: "We host Voltmart so we can break it for real: class renames, nested fields, a table
  layout — not a cosmetic tweak. Watch the watchdog detect the break, drive Bright Data's
  self-heal flow: refactor, approve, re-run, verify. Same collector ID. No humans."
- Insert: health page — incident #1 receipt timeline expanding step by step

## Shot 4 — Wrap (2:50–3:20) — receipts + criteria 3
- Screen: /health — incident timeline with multiple auto-heal receipts from the week (chaos-test cron)
- VO: "It ran all week unattended — every heal an event-sourced receipt: detect, diagnose,
  repair, verify. Reliability you can audit, not claim."
- End card: repo URL + "Built on Bright Data Scraper Studio · Into the Scrape-Verse 2026"

## Shot 3 — THE MOMENT: Chaos Lab (1:50–3:20) — self-healing live (criteria 2, 5)
- Screen: /chaos page, calm green feed
- **Click "Redesign store (v2)"** — button grays, feed starts:
  1. `run: chaos · 96 rows → price null on 78 rows` (red flash)
  2. `incident #7 opened · null_burst · severity high`
  3. `heal: refactor_template requested` → `polling… step=code_generator`
  4. `awaiting_approval → auto-approved (auto_save)`
  5. `rerun → 96 rows · 0 nulls` (green flash) → `incident closed · 4m 12s`
- While polling: cut to dashboard — data gap graph shows ZERO missing rows downstream (old data persists while healing)
- VO: "We host our own store so we can break it on purpose. Watch: layout flipped, extraction dead. The watchdog opens an incident, sends a plain-language repair prompt to Scraper Studio, approves the diff, re-runs, verifies. Four minutes, zero humans — and downstream consumers never saw a gap."
- (If heal runs long: time-lapse the polling segment — keep raw footage for judges' scrutiny in repo)

## Shot 4 — Receipts + wrap (3:20–3:50) — credibility (criteria 3, 5)
- Screen: /health incident timeline — scroll: nightly auto-chaos runs, heals across v1→v2→v3, one honest failed heal + retry
- VO: "Every incident is an event-sourced receipt: detect, diagnose, repair, verify. It ran all week, unattended, including the failures — because reliability isn't a demo, it's a log."
- End card: repo URL + dashboard URL + "Built on Bright Data Scraper Studio · WeMakeDevs Into the Scrape-Verse 2026"

## Fallback plans (rehearse Aug 22 morning)
| Failure | Fallback |
|---|---|
| Live heal stalls >6 min | Pre-recorded heal from previous night (same SSE UI, replay mode built into /chaos — a "replay" data source toggle) |
| Vercel chaos switch fails | Redeploy manually mid-demo (10s) — rehearse the click path |
| Internet/API outage | Full backup recording of entire demo; submit raw + backup |
| Dashboard bug | Freeze code Aug 22 noon; demo from the frozen build |

## Recording checklist
- [ ] 1080p, 16:9, cursor highlight on
- [ ] Mic test; VO script rehearsed ×3 (read Shot VOs verbatim — they're written for timing)
- [ ] Terminal font 16pt+, dashboard in dark theme
- [ ] Export: MP4 H.264 <500MB; name: `hydra-demo.mp4`
