"use client";

import { useEffect, useRef, useState } from "react";
import { Flame } from "lucide-react";
import { WORKER_URL } from "@/lib/api";

interface Event {
  ts: string;
  type: "run" | "incident" | "heal" | "alert" | "chaos" | "system";
  collector: string;
  payload: unknown;
}

const badge: Record<string, { bg: string; fg: string }> = {
  run: { bg: "var(--border)", fg: "var(--foreground)" },
  incident: { bg: "rgba(248,81,73,0.15)", fg: "var(--red)" },
  heal: { bg: "rgba(210,153,34,0.15)", fg: "var(--amber)" },
  chaos: { bg: "rgba(88,166,255,0.15)", fg: "var(--blue)" },
  alert: { bg: "rgba(63,185,80,0.15)", fg: "var(--green)" },
  system: { bg: "var(--border)", fg: "var(--green)" },
};

interface FeedResponse {
  events: { kind: string; step: string; status: string; detail_json: string | null; created_at: string; collector: string }[];
  incidents: { id: number; type: string; severity: string; status: string; opened_at: string; closed_at: string | null; detail: string; collector: string }[];
  runs: { id: number; status: string; rows_in: number; rows_valid: number; finished_at: string | null; collector: string }[];
  ts: string;
}

function feedToEvents(f: FeedResponse): Event[] {
  const out: Event[] = [];
  for (const e of f.events) {
    out.push({
      ts: e.created_at,
      type: e.step === "detected" ? "incident" : "heal",
      collector: e.collector,
      payload: { step: e.step, status: e.status, detail: e.detail_json },
    });
  }
  for (const i of f.incidents) {
    out.push({
      ts: i.closed_at ?? i.opened_at,
      type: "incident",
      collector: i.collector,
      payload: { id: i.id, type: i.type, severity: i.severity, status: i.status, detail: i.detail },
    });
  }
  for (const r of f.runs) {
    if (!r.finished_at) continue;
    out.push({
      ts: r.finished_at,
      type: "run",
      collector: r.collector,
      payload: { runId: r.id, status: r.status, rowsIn: r.rows_in, rowsValid: r.rows_valid },
    });
  }
  return out.sort((a, b) => (a.ts < b.ts ? 1 : -1)).slice(0, 80);
}

export default function ChaosLab() {
  const [events, setEvents] = useState<Event[]>([]);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [mode, setMode] = useState<"sse" | "poll">("sse");
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let dead = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    // Polling fallback: if SSE fails to open within 4s, poll /api/feed every 8s.
    const openCheck = setTimeout(() => {
      if (!connected) {
        setMode("poll");
        pollTimer = setInterval(async () => {
          try {
            const r = await fetch(`${WORKER_URL}/api/feed`, { cache: "no-store" });
            if (!r.ok) return;
            const feed = (await r.json()) as FeedResponse;
            setEvents(feedToEvents(feed));
            setConnected(true);
          } catch {
            setConnected(false);
          }
        }, 8000);
      }
    }, 4000);

    const es = new EventSource(`${WORKER_URL}/api/stream`);
    esRef.current = es;
    es.onopen = () => {
      setConnected(true);
      setMode("sse");
      clearTimeout(openCheck);
      if (pollTimer) clearInterval(pollTimer);
    };
    es.onerror = () => {
      if (mode !== "poll") setConnected(false);
    };
    es.onmessage = (m) => {
      const evt = JSON.parse(m.data) as Event;
      setEvents((prev) => [evt, ...prev].slice(0, 80));
    };
    return () => {
      clearTimeout(openCheck);
      if (pollTimer) clearInterval(pollTimer);
      es.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function redesign() {
    setBusy(true);
    try {
      const r = await fetch(`${WORKER_URL}/api/chaos/redesign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await r.json();
      if (!r.ok) console.error(data);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="panel p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1">
          <h1 className="text-xl font-bold">Chaos Lab</h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
            Voltmart is a store we control. Redesign it below, then watch HYDRA detect the break,
            self-heal the scraper, and recover — live, no humans.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs mono" style={{ color: connected ? "var(--green)" : "var(--red)" }}>
            {connected ? `● live (${mode})` : "○ disconnected"}
          </span>
          <button
            onClick={redesign}
            disabled={busy}
            className="px-4 py-2 rounded-lg font-semibold text-sm text-black"
            style={{ background: "var(--red)", opacity: busy ? 0.6 : 1 }}
          >
            {busy ? "Redesigning…" : (<span className="inline-flex items-center gap-2"><Flame className="h-4 w-4" /> Redesign store</span>)}
          </button>
        </div>
      </div>

      <div className="panel divide-y" style={{ borderColor: "var(--border)" }}>
        {events.length === 0 ? (
          <div className="p-8 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>
            Waiting for events… press the redesign button, or let the scheduler run.
          </div>
        ) : (
          events.map((e, i) => {
            const b = badge[e.type] ?? badge.run;
            return (
              <div key={i} className="px-4 py-2.5 flex items-start gap-3 text-sm">
                <span className="mono text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                  {String(e.ts ?? "").replace("T", " ").replace("Z", "").slice(11, 19)}
                </span>
                <span className="mono text-[11px] px-1.5 py-0.5 rounded" style={{ background: b.bg, color: b.fg }}>
                  {e.type}
                </span>
                <span className="font-medium">{e.collector}</span>
                <span className="flex-1 mono text-xs truncate" style={{ color: "var(--muted-foreground)" }}>
                  {JSON.stringify(e.payload)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
