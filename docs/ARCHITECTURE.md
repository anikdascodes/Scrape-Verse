# HYDRA — Architecture Diagram (README-ready)
> Mermaid renders on GitHub natively. Also export PNG Aug 17 (mermaid.live) → docs/assets/architecture.png

```mermaid
flowchart TB
    subgraph TARGETS["Targets (public pages)"]
        NG["Newegg\nGPU category (USD)"]
        MC["Micro Center\nGPU category (USD)"]
        MF["Mindfactory (DE)\nGPU category (EUR)"]
        CS["Chaos Store\n(we host — 3 layouts)"]
    end

    subgraph BD["Bright Data Scraper Studio"]
        C1["Collector c_newegg"]
        C2["Collector c_micro"]
        C3["Collector c_mindf"]
        C4["Collector c_chaos"]
        AI["AI Flow API\nself-heal: refactor_template →\nresume_automation_job"]
    end

    subgraph WORKER["hydra-core worker (Node/TS)"]
        SCHED["Scheduler\nreal 6h · chaos 30min"]
        ING["Ingest + Normalize\n(EUR comma, GPU model regex)"]
        VAL["Validators\nzod · null-rate · row-count\nfreshness · schema"]
        WD["Watchdog\nincident management"]
        HQ["Heal Queue\nGLOBAL SERIAL (429-safe)"]
        HO["Heal Orchestrator\ndetect→diagnose→heal→\napprove→rerun→verify"]
        DB[("SQLite WAL\nruns · prices · incidents\nheal_events · alerts")]
        API["Fastify REST + SSE"]
    end

    subgraph WEB["hydra-web (Next.js)"]
        OV["Overview + GPU history\nbest price · alerts"]
        HP["Health\nincident timeline + receipts"]
        CL["Chaos Lab\nredesign button · live SSE"]
    end

    NG -->|unblocked| C1
    MC -->|unblocked| C2
    MF -->|unblocked| C3
    CS -->|unblocked| C4

    SCHED -->|trigger /dca/trigger| C1 & C2 & C3 & C4
    C1 & C2 & C3 & C4 -->|poll /dca/dataset| ING
    ING --> VAL --> WD
    VAL --> DB
    WD -->|breach| HQ --> HO
    HO -->|"heal prompt"| AI
    AI -->|approved diff, same c_id| C4
    HO -->|verify rerun| ING
    HO --> DB
    WD --> DB

    DB --> API
    HO -->|events| API
    API -->|SSE + REST| OV & HP & CL
    CL -->|"redesign → deploy hook"| CS

    CLI["Coding agent (Claude Code / Opencode)\nbdata scraper create · run · heal"] -.->|"grand-prize arc:\ndriven from agent"| BD
```

## One-line data flow (for README text)
`stores → Bright Data collectors → worker ingest → validators → SQLite → dashboard · breach → watchdog → heal queue → AI Flow repair → verify → close`

## Three-track story (README section)
- **Web-Slinger**: collectors created/healed from coding agent via CLI + AI Flow; live chaos proof
- **Suit-Up**: zero-login dashboard, multi-currency price intel, live SSE chaos lab
- **Spider-Sense**: typed monorepo, event-sourced receipts, serial heal queue, honest failure logs
