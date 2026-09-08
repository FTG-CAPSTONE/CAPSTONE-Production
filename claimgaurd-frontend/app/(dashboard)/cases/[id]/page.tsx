"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { AuditEvent, CaseDetail } from "@/lib/types";
import { ShapExplanation } from "@/components/shap-explanation";
import { RuleFlagsList } from "@/components/rule-flags-list";

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [rationale, setRationale] = useState("");

  const { data: caseDetail, isLoading } = useQuery({
    queryKey: ["case", id],
    queryFn: async () => (await apiClient.get<CaseDetail>(`/api/cases/${id}`)).data,
  });

  const { data: auditTrail } = useQuery({
    queryKey: ["audit", id],
    queryFn: async () => (await apiClient.get<AuditEvent[]>("/api/audit", { params: { case_id: id } })).data,
  });

  const decide = useMutation({
    mutationFn: async (decision: "approve" | "decline" | "escalate") =>
      apiClient.post(`/api/cases/${id}/decision`, null, { params: { decision, rationale } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case", id] });
      queryClient.invalidateQueries({ queryKey: ["audit", id] });
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      setRationale("");
    },
  });

  if (isLoading || !caseDetail) return <p className="text-sm text-slate-500">Loading...</p>;

  const latestPrediction = caseDetail.predictions[caseDetail.predictions.length - 1];

  return (
    <div>
      <button onClick={() => router.back()} className="mb-4 text-sm text-blue-700 hover:underline">
        ← Back
      </button>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{caseDetail.external_ref}</h1>
          <p className="text-sm text-slate-500 capitalize">
            {caseDetail.line_of_business.replace("_", " ")} · Status: {caseDetail.status}
          </p>
        </div>
        <p className="text-xl font-semibold">
          {caseDetail.amount.toLocaleString(undefined, { style: "currency", currency: "KES" })}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-slate-500">ML Risk Assessment</h2>
          {latestPrediction ? (
            <ShapExplanation prediction={latestPrediction} />
          ) : (
            <p className="text-sm text-slate-500">No prediction recorded.</p>
          )}
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-slate-500">Rules Triggered</h2>
          <div className="rounded-lg border border-slate-200 p-4">
            <RuleFlagsList rules={caseDetail.rules} />
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 p-4">
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-slate-500">Reviewer Decision</h2>
        <textarea
          className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          rows={2}
          placeholder="Rationale (required — every decision must be explained and is permanently auditable)"
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            disabled={!rationale || decide.isPending}
            onClick={() => decide.mutate("approve")}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Approve
          </button>
          <button
            disabled={!rationale || decide.isPending}
            onClick={() => decide.mutate("decline")}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Decline
          </button>
          <button
            disabled={!rationale || decide.isPending}
            onClick={() => decide.mutate("escalate")}
            className="rounded-md bg-slate-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Escalate
          </button>
        </div>
      </div>

      <div className="mt-6">
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-slate-500">Audit Trail</h2>
        <ul className="space-y-2 rounded-lg border border-slate-200 p-4 text-sm">
          {(auditTrail ?? []).map((e, i) => (
            <li key={i} className="flex justify-between text-slate-700">
              <span>
                <span className="font-medium">{e.event_type}</span> by {e.actor}
              </span>
              <span className="text-slate-400">{new Date(e.occurred_at).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
