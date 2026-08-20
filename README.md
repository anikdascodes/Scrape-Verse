# HYDRA — self-healing GPU price intelligence

> **Cut one head off, it grows back.**

HYDRA monitors GPU prices across multiple online stores using custom scrapers built with
**[Bright Data Scraper Studio](https://brightdata.com/products/scraper-studio)**. Every run is
validated; when a store redesigns and a scraper breaks, a watchdog detects the failure, drives
Bright Data's **self-healing** flow end-to-end, and repairs the scraper automatically — no
selectors to maintain, no humans in the loop.

Built solo for **WeMakeDevs × Bright Data — Into the Scrape-Verse** (Aug 17–23 2026).

---

## What it does

1. **Collects** — four custom Scraper Studio collectors pull GPU listings from
   **Newegg**, **B&H Photo**, **Mindfactory** (Germany, EUR) and a fictional demo store
   (*Voltmart*) that we host and can redesign on demand.
2. **Validates** — every run is scored against a schema *and* statistical guards: null-rate,
   row-count drift, freshness, price sanity.
3. **Detects** — breaches open deduplicated incidents with full context.
4. **Self-heals** — a serial queue drives the Bright Data AI Flow repair loop:
   `refactor_template → poll → approve → re-run → verify`. The Collector ID never changes.
5. **Proves it** — *Chaos Lab* lets you redesign the demo store live and watch the pipeline
   detect, repair and recover in real time, with an event-sourced receipt for every step.

## Architecture

```
stores → Bright Data collectors → worker (ingest → validate → watchdog)
        ↓ breach                          ↓
        heal orchestrator → AI Flow repair → verify → close
        ↓                                 ↓
        SQLite ────────────→ Next.js dashboard (overview / history / health / chaos lab)
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full diagram.

## Repo layout

```
apps/worker   Node/TS pipeline: scheduler, ingest, validators, watchdog, heal orchestrator,
              Fastify API + SSE, chaos redesign
apps/web      Next.js dashboard (App Router, Tailwind)
chaos-store   Voltmart — a static demo store with 3 layout variants we cycle to break scrapers
docs/         architecture, example structured output, self-heal receipts
```

## Two verticals, one self-healing platform

HYDRA is vertical-agnostic: GPU price intelligence and Indian hotel rate comparison run on the
same pipeline — same schedule, same watchdog, same heal queue, same receipts.

### The collectors (proof of create-and-run)

Created from the coding agent via `bdata scraper create <url> "<plain-language fields>"`:

| Vertical | Store / platform | Collector ID | Status |
|---|---|---|---|
| travel | Treebo (Goa) | `c_mt0c9y032or8r8ijpi` | ✅ 6 hotels/run |
| travel | FabHotels (Goa) | `c_mt0e3tame0ha2e59g` | ✅ 4 hotels/run (healed: empty-extraction → list-level) |
| gpu | Mindfactory (DE) | `c_mswy6s6g2737n9yo97` | ✅ 2,500+ rows/run (healed: scope + EUR format) |
| gpu | B&H Photo | `c_msx1ffltc5z0dpafz` | ✅ 28 rows/run (healed: price format) |
| gpu | Newegg | `c_mswxuxrc1k9tpskymz` | ✅ 12 rows/run |
| gpu | Voltmart (chaos demo store) | `c_msx1fds1k6o3wjymc` | ✅ 20 rows/run — self-heals on every redesign |

Every one of these is a **long-tail, custom** Scraper Studio collector — regional chains,
specialist stores and a host we control — none served by a pre-built scraper. Same IDs after
every heal: the Collector ID never changes across repairs.

### The travel product

`/travel` tracks Indian budget-chain hotels (Treebo, FabHotels) that exist on exactly one
platform — inventory is genuinely exclusive in this market. Every listing gets a rate history,
drop/restock alerts, source link and collection time in the **exclusive rail**, plus a
cross-platform matcher (brand+ID blocking, fuzzy scoring with confidence) that links properties
whenever two platforms do overlap. No estimated or undated prices anywhere.

## Demo of self-healing (the real thing)

On Aug 17 we flipped Voltmart from layout v1 to v2 and immediately triggered the collector:

```
10:05:45  detected            store redesigned → 0 valid rows
10:05:45  diagnosed           plain-language repair prompt built
10:05:45  refactor_requested  sent to Bright Data AI Flow
10:05:46  polling             AI regenerating the scraper
10:07:21  awaiting_approval   candidate diff produced
10:07:22  approved (auto)     approved + saved unattended
10:07:23  rerun               healed collector re-triggered
10:07:36  verified_ok         20 rows, 0 nulls — recovered
10:07:36  closed              incident resolved
```

**1 minute 51 seconds, zero human intervention.** The full machine-readable receipt is in
[`docs/example-output/self-heal-receipt.json`](docs/example-output/self-heal-receipt.json).

## How Scraper Studio is used (required)

HYDRA is built *on* Scraper Studio, not around it:

- **Design** — each collector is created with `bdata scraper create <url> "<plain-language fields>"`,
  run from inside the coding agent. Bright Data's AI Agent generates the schema and code.
- **Run** — the worker triggers collectors through the Collection API
  (`POST /dca/trigger`, poll `GET /dca/dataset`) and normalizes results (multi-currency,
  GPU-model extraction, nested-array flattening).
- **Self-heal** — breakage is repaired through the AI Flow API
  (`refactor_template → refactor_template/progress → resume_automation_job`), keeping the same
  Collector ID so all integrations continue uninterrupted.

## Getting started

```bash
# prerequisites: Node 20+, a Bright Data account with an API token
git clone https://github.com/anikdascodes/Scrape-Verse.git
cd Scrape-Verse

# 1. worker
cp .env.example .env        # set BRIGHT_DATA_API_KEY + COLLECTOR_* ids
cd apps/worker && npm install && npm run db:init && npm run dev

# 2. dashboard (reads the worker API at :8787)
cd ../web && npm install && npm run dev
```

## Environment

| Var | Meaning |
|---|---|
| `BRIGHT_DATA_API_KEY` | Bright Data API token (Bearer) |
| `COLLECTOR_NEWEGG` / `_BHPHOTO` / `_MINDFACTORY` / `_CHAOS` | Collector IDs (`c_*`) |
| `CHAOS_STORE_URL` | the deployed Voltmart URL |
| `WORKER_PORT` / `HYDRA_DB_PATH` / `SCHEDULER` | optional overrides |

## Design decisions worth knowing

- **Pricing robustness** — stores render prices in many formats (US `$1,309.99`, German
  `1.179,00`, Bright Data price *objects* in cents). One normalizer handles them all, with
  defensive heuristics for the "AI divided by 100/1000" class of bug.
- **Serial heal queue** — Bright Data caps concurrent AI jobs, so all heal jobs are
  serialized to avoid 429s.
- **Human-gated vs. autonomous** — the *Voltmart* chaos collector heals autonomously
  (`auto_save`); real-store healers can be gated for a human approval step.
- **Network** — this machine's DNS returns broken NAT64 IPv6 addresses, so the worker forces
  IPv4 sockets.

## Example output

See [`docs/example-output/`](docs/example-output/) for sampled prices, run history, and the
self-heal receipt.

## AI-use disclosure

Built with AI coding assistants (opencode + Claude-class models) driving the editor. Every
line was reviewed, tested, and is understood and explainable by the author. The scrapers
themselves are created and self-healed by Bright Data Scraper Studio's AI Agent via its CLI
and REST API — that is the point of the project.

## License

MIT
