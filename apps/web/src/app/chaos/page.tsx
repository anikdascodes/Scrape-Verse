"use client";

import { useEffect, useRef, useState } from "react";
import { Flame } from "lucide-react";
import { WORKER_URL } from "@/lib/api";

interface Event {
  ts: string;
  type: "run" | "incident" | "heal" | "alert" | "chaos";
  collector: string;
  payload: unknown;
}

const badge: Record<string, { bg: string; fg: string }> = {
  run: { bg: "var(--border)", fg: "var(--foreground)" },
  incident: { bg: "rgba(248,81,73,0.15)", fg: "var(--red)" },
  heal: { bg: "rgba(210,153,34,0.15)", fg: "var(--amber)" },
  chaos: { bg: "rgba(88,166,255,0.15)", fg: "var(--blue)" },
  alert: { bg: "rgba(63,185,80,0.15)", fg: "var(--green)" },
};

export default function ChaosLab() {
  const [events, setEvents] = useState<Event[]>([]);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(`${WORKER_URL}/api/stream`);
    esRef.current = es;
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (m) => {
      const evt = JSON.parse(m.data) as Event;
      setEvents((prev) => [evt, ...prev].slice(0, 80));
    };
    return () => es.close();
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
            {connected ? "● live" : "○ disconnected"}
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
                  {e.ts.slice(11, 19)}
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
