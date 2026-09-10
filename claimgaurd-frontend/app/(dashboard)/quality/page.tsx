"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { QualitySummary } from "@/lib/types";

const STAT_KEYS: Array<{ key: keyof QualitySummary; label: string; format?: (v: number) => string }> = [
  { key: "total",       label: "Total" },
  { key: "trusted",     label: "Trusted" },
  { key: "corrected",   label: "Corrected" },
  { key: "rejected",    label: "Rejected" },
  { key: "trusted_pct", label: "Trust Rate", format: (v) => `${v.toFixed(1)}%` },
];

const DECISION_COLOR: Record<string, string> = {
  trusted:   "bg-emerald-100 text-emerald-700",
  corrected: "bg-amber-100 text-amber-700",
  rejected:  "bg-red-100 text-red-700",
};

export default function QualityPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["quality-summary"],
    queryFn: async () => (await apiClient.get<QualitySummary>("/api/quality/summary")).data,
  });

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Data Quality</h1>

      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}

      {data && (
        <>
          {/* Summary stat tiles — numeric fields only */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5 max-w-3xl">
            {STAT_KEYS.map(({ key, label, format }) => {
              const raw = data[key] as number;
              return (
                <div key={key} className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
                  <p className="mt-1 text-2xl font-semibold">
                    {format ? format(raw) : raw}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Recent events list */}
          {data.recent_events.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Recent Events
              </h2>
              <div className="rounded-xl border border-slate-200 bg-white">
                <ul className="divide-y divide-slate-100">
                  {data.recent_events.map((ev) => (
                    <li key={ev.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${
                          DECISION_COLOR[ev.decision ?? ""] ?? "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {ev.decision ?? "—"}
                      </span>
                      <span className="text-sm">
                        <strong>{ev.field_name ?? "—"}</strong>
                        {ev.issue_type && (
                          <> · <span className="text-slate-500">{ev.issue_type.replace(/_/g, " ")}</span></>
                        )}
                      </span>
                      <span className="ml-auto shrink-0 text-xs text-slate-400">
                        {new Date(ev.created_at).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
