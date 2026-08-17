export default function About() {
  return (
    <div className="max-w-3xl space-y-6 text-sm leading-relaxed">
      <h1 className="text-xl font-bold">How HYDRA works</h1>
      <p>
        HYDRA is a self-healing web-data pipeline. Custom scrapers built in{" "}
        <a href="https://brightdata.com/products/scraper-studio" target="_blank" className="underline" style={{ color: "var(--blue)" }}>
          Bright Data Scraper Studio
        </a>{" "}
        collect GPU prices from multiple stores. Every run is validated (schema, null-rates, row counts,
        freshness). When a store redesigns and extraction breaks, the watchdog opens an incident and an
        orchestrator drives Bright Data&apos;s self-heal API end to end:{" "}
        <span className="mono">refactor_template → approve → re-run → verify</span>. The collector ID never
        changes, and downstream data keeps flowing from the last good snapshot while the repair runs.
      </p>
      <ol className="list-decimal pl-6 space-y-2">
        <li><b>Ingest</b> — collectors trigger on a schedule via the Scraper Studio API; rows land in SQLite.</li>
        <li><b>Validate</b> — zod schemas plus statistical guards score every run.</li>
        <li><b>Detect</b> — breaches open deduplicated incidents.</li>
        <li><b>Heal</b> — a serial queue drives the AI Flow repair loop, one AI job at a time.</li>
        <li><b>Verify</b> — the healed collector must produce healthy rows before the incident closes.</li>
      </ol>
      <p style={{ color: "var(--muted)" }}>
        Chaos Lab proves it live: a fictional store we host can be redesigned at the push of a button —
        watch the pipeline detect, repair and recover in real time.
      </p>
    </div>
  );
}
