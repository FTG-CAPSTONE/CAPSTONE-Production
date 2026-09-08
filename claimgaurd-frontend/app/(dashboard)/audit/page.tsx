"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { AuditEvent } from "@/lib/types";

export default function AuditPage() {
  const [caseIdInput, setCaseIdInput] = useState("");
  const [caseIdFilter, setCaseIdFilter] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["audit-events", caseIdFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (caseIdFilter.trim()) params.case_id = caseIdFilter.trim();
      // Correct endpoint: /api/audit  (not /api/audit/events)
      return (await apiClient.get<AuditEvent[]>("/api/audit", { params })).data;
    },
  });

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Audit Trail</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Immutable log of all system and user actions.
      </p>

      {/* Filter bar */}
      <div className="mb-4 flex items-center gap-2">
        <input
          type="text"
          placeholder="Filter by Case ID (optional)"
          value={caseIdInput}
          onChange={(e) => setCaseIdInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && setCaseIdFilter(caseIdInput)}
          className="w-72 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={() => setCaseIdFilter(caseIdInput)}
          className="rounded-md bg-blue-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-800"
        >
          Search
        </button>
        {caseIdFilter && (
          <button
            onClick={() => { setCaseIdInput(""); setCaseIdFilter(""); }}
            className="text-sm text-slate-500 hover:text-slate-800"
          >
            Clear
          </button>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : !data?.length ? (
          <p className="p-6 text-sm text-muted-foreground">
            {caseIdFilter ? `No events for case ${caseIdFilter}.` : "No audit events found."}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Case</th>
                <th className="px-4 py-3 text-right">Time</th>
              </tr>
            </thead>
            <tbody>
              {data.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                  <td className="px-4 py-3 font-medium capitalize">
                    {e.event_type?.replace(/_/g, " ") ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{e.actor ?? "system"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {e.case_id?.slice(0, 8) ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {e.occurred_at ? new Date(e.occurred_at).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
