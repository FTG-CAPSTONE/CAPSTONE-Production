"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import type { Investigation } from "@/lib/types";

const STATUS_COLOR: Record<string, string> = {
  open:       "bg-amber-100 text-amber-700",
  closed:     "bg-slate-100 text-slate-600",
  in_progress:"bg-blue-100 text-blue-700",
};

const OUTCOME_COLOR: Record<string, string> = {
  confirmed_fraud: "bg-red-100 text-red-700",
  not_fraud:       "bg-emerald-100 text-emerald-700",
  inconclusive:    "bg-slate-100 text-slate-600",
};

export default function InvestigationsPage() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Investigation | null>(null);
  const [findings, setFindings] = useState("");
  const [outcome, setOutcome] = useState<"confirmed_fraud" | "not_fraud" | "inconclusive">("inconclusive");

  const { data: investigations, isLoading } = useQuery({
    queryKey: ["investigations"],
    queryFn: async () =>
      (await apiClient.get<Investigation[]>("/api/hitl/investigations")).data,
  });

  // Close an investigation: POST /api/hitl/investigations/{id}/close
  const closeMutation = useMutation({
    mutationFn: async ({
      id,
      findings,
      outcome,
    }: {
      id: string;
      findings: string;
      outcome: string;
    }) =>
      apiClient.post(`/api/hitl/investigations/${id}/close`, { findings, outcome }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investigations"] });
      setSelected(null);
      setFindings("");
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Investigations</h1>
      <p className="text-sm text-slate-500">
        Active and closed fraud investigations. Open an investigation from the Review Queue.
      </p>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : !investigations?.length ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          No investigations yet.{" "}
          <Link href="/hitl" className="text-blue-700 hover:underline">
            Go to Review Queue →
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Case</th>
                <th className="px-4 py-3">Investigator</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Outcome</th>
                <th className="px-4 py-3">Opened</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {investigations.map((inv) => (
                <tr
                  key={inv.id}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/cases/${inv.case_id}`}
                      className="font-mono text-xs text-blue-700 hover:underline"
                    >
                      {inv.case_id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {inv.investigator_name ?? "Unassigned"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        STATUS_COLOR[inv.status] ?? "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {inv.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {inv.outcome ? (
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${
                          OUTCOME_COLOR[inv.outcome] ?? "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {inv.outcome.replace(/_/g, " ")}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {new Date(inv.opened_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {inv.status !== "closed" && (
                      <button
                        onClick={() => {
                          setSelected(inv);
                          setFindings(inv.findings ?? "");
                        }}
                        className="rounded-md bg-slate-800 px-3 py-1 text-xs font-medium text-white hover:bg-slate-700"
                      >
                        Close
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Close investigation modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-1 text-base font-semibold">Close Investigation</h2>
            <p className="mb-4 text-xs text-slate-500">
              Case {selected.case_id.slice(0, 8)}
            </p>

            <label className="mb-1 block text-xs font-medium text-slate-600">
              Outcome
            </label>
            <select
              value={outcome}
              onChange={(e) =>
                setOutcome(e.target.value as typeof outcome)
              }
              className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="confirmed_fraud">Confirmed Fraud</option>
              <option value="not_fraud">Not Fraud</option>
              <option value="inconclusive">Inconclusive</option>
            </select>

            <label className="mb-1 block text-xs font-medium text-slate-600">
              Findings
            </label>
            <textarea
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
              rows={4}
              placeholder="Summarise investigation findings…"
              className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setSelected(null)}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                disabled={!findings.trim() || closeMutation.isPending}
                onClick={() =>
                  closeMutation.mutate({
                    id: selected.id,
                    findings: findings.trim(),
                    outcome,
                  })
                }
                className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 hover:bg-red-800"
              >
                {closeMutation.isPending ? "Closing…" : "Close Investigation"}
              </button>
            </div>

            {closeMutation.isError && (
              <p className="mt-2 text-xs text-red-600">Failed to close. Try again.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
