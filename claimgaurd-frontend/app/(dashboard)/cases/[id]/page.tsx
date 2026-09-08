"use client";

import { useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Upload } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { CaseDetail, MLPrediction } from "@/lib/types";
import { ShapExplanation } from "@/components/shap-explanation";
import { RuleFlagsList } from "@/components/rule-flags-list";

// Decisions accepted by POST /api/cases/{case_id}/decision
const DECISIONS = [
  { value: "approved",     label: "Approve",      cls: "bg-emerald-600 hover:bg-emerald-700 text-white" },
  { value: "declined",     label: "Decline",      cls: "bg-red-600 hover:bg-red-700 text-white" },
  { value: "escalated",    label: "Escalate",     cls: "bg-purple-600 hover:bg-purple-700 text-white" },
  { value: "request_docs", label: "Request Docs", cls: "bg-amber-500 hover:bg-amber-600 text-white" },
] as const;

type DecisionValue = (typeof DECISIONS)[number]["value"];

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(amount: string | null) {
  if (!amount) return "—";
  return `KES ${parseFloat(amount).toLocaleString()}`;
}

function fmtScore(s: string | null) {
  if (!s) return "—";
  return parseFloat(s).toFixed(0);
}

function fmtPct(s: string | null) {
  if (!s) return "—";
  return `${(parseFloat(s) * 100).toFixed(0)}%`;
}

// ── component ─────────────────────────────────────────────────────────────────

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [decision, setDecision] = useState<DecisionValue | "">("");
  const [rationale, setRationale] = useState("");
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── queries ─────────────────────────────────────────────────────────────────

  const { data: c, isLoading } = useQuery({
    queryKey: ["case", id],
    queryFn: async () => (await apiClient.get<CaseDetail>(`/api/cases/${id}`)).data,
  });

  // ML prediction + SHAP — separate endpoint
  const { data: prediction } = useQuery({
    queryKey: ["ml-prediction", id],
    queryFn: async () => {
      try {
        return (await apiClient.get<MLPrediction>(`/api/ml/predictions/${id}`)).data;
      } catch {
        return null;
      }
    },
    enabled: !!id,
  });

  // ── mutations ────────────────────────────────────────────────────────────────

  // Decision: POST /api/cases/{id}/decision  body: { decision, rationale }
  const decideMutation = useMutation({
    mutationFn: async ({ decision, rationale }: { decision: DecisionValue; rationale: string }) =>
      apiClient.post(`/api/cases/${id}/decision`, { decision, rationale }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case", id] });
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      queryClient.invalidateQueries({ queryKey: ["hitl-queue"] });
      setDecision("");
      setRationale("");
    },
  });

  // Evidence export: GET /api/cases/{id}/evidence-export  → download JSON
  async function handleExport() {
    try {
      const res = await apiClient.get(`/api/cases/${id}/evidence-export`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `evidence-${id.slice(0, 8)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Export failed. Try again.");
    }
  }

  // Document upload: POST /api/cases/{id}/documents  multipart
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadStatus("uploading");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("doc_type", "supporting");
      await apiClient.post(`/api/cases/${id}/documents`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUploadStatus("done");
      queryClient.invalidateQueries({ queryKey: ["case", id] });
    } catch {
      setUploadStatus("error");
    }
  }

  // ── render ───────────────────────────────────────────────────────────────────

  if (isLoading || !c)
    return <p className="p-4 text-sm text-slate-500">Loading case…</p>;

  const flaggedRules = c.rule_evaluations.filter((r) => r.result !== "pass");
  const passedRules  = c.rule_evaluations.filter((r) => r.result === "pass");

  return (
    <div className="max-w-4xl space-y-6">
      {/* Back + header */}
      <div>
        <button
          onClick={() => router.back()}
          className="mb-2 text-sm text-blue-700 hover:underline"
        >
          ← Back
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">
              {c.external_claim_id ?? c.id.slice(0, 8)}
            </h1>
            <p className="text-sm text-slate-500">
              {c.claim_type?.replace(/_/g, " ") ?? c.line_of_business} ·{" "}
              <span className="capitalize">{c.status.replace(/_/g, " ")}</span> ·{" "}
              {fmt(c.amount_claimed)}
            </p>
          </div>
          {/* Evidence export button */}
          <button
            onClick={handleExport}
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Export Evidence
          </button>
        </div>
      </div>

      {/* Risk Assessment */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold">Risk Assessment</h2>
        <div className="grid grid-cols-2 gap-4 mb-4 md:grid-cols-4">
          <div>
            <p className="text-xs text-slate-500">Fraud Score</p>
            <p className="text-2xl font-bold">{fmtScore(c.fraud_score)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Band</p>
            <p className="text-lg font-semibold capitalize">{c.fraud_band ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Confidence</p>
            <p className="text-lg font-semibold">{fmtPct(c.confidence)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Complexity</p>
            <p className="text-lg font-semibold">
              {c.complexity_score != null ? `${parseFloat(c.complexity_score).toFixed(0)}/100` : "—"}
            </p>
          </div>
        </div>
        {prediction?.shap_values?.length ? (
          <ShapExplanation features={prediction.shap_values} />
        ) : (
          <p className="text-xs text-slate-400">
            {prediction?.note ?? "No SHAP explanation available yet."}
          </p>
        )}
      </section>

      {/* Rule Evaluations */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold">
          Rule Evaluations
          {flaggedRules.length > 0 && (
            <span className="ml-2 rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">
              {flaggedRules.length} flag{flaggedRules.length > 1 ? "s" : ""}
            </span>
          )}
        </h2>
        <RuleFlagsList rules={[...flaggedRules, ...passedRules]} />
      </section>

      {/* Case Details grid */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold">Case Details</h2>
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
          {([
            ["Claim type",    c.claim_type?.replace(/_/g, " ") ?? "—"],
            ["LOB",           c.line_of_business],
            ["Currency",      c.currency],
            ["Incident date", c.incident_date ?? "—"],
            ["Reported date", c.reported_date ?? "—"],
            ["Submitted",     c.submitted_at ? new Date(c.submitted_at).toLocaleDateString() : "—"],
            ["Policy",        c.policy?.external_id ?? "—"],
            ["Claimant",      c.claimant?.full_name ?? "—"],
            ["Provider",      c.provider?.full_name ?? "—"],
          ] as [string, string][]).map(([label, value]) => (
            <div key={label}>
              <p className="text-xs text-slate-500">{label}</p>
              <p className="font-medium capitalize">{value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Documents + upload */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">
            Documents
            {c.documents.length > 0 && (
              <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {c.documents.length}
              </span>
            )}
          </h2>
          {/* Upload button */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleUpload}
              accept=".pdf,.png,.jpg,.jpeg,.docx"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadStatus === "uploading"}
              className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              {uploadStatus === "uploading" ? "Uploading…" : "Upload Document"}
            </button>
            {uploadStatus === "done" && (
              <p className="mt-1 text-xs text-emerald-600">✓ Uploaded</p>
            )}
            {uploadStatus === "error" && (
              <p className="mt-1 text-xs text-red-600">Upload failed</p>
            )}
          </div>
        </div>

        {c.documents.length === 0 ? (
          <p className="text-sm text-slate-400">No documents attached.</p>
        ) : (
          <ul className="space-y-2">
            {c.documents.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium">{doc.original_filename ?? doc.id.slice(0, 12)}</span>
                  <span className="ml-2 text-xs text-slate-400 capitalize">
                    {doc.doc_type.replace(/_/g, " ")}
                  </span>
                </div>
                <a
                  href={`/api/cases/${c.id}/documents/${doc.id}/download`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-700 hover:underline"
                >
                  Download
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Audit Trail */}
      {c.audit_events.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold">Audit Trail</h2>
          <ul className="space-y-1.5">
            {c.audit_events.map((ev, idx) => (
              <li key={`${ev.id ?? idx}`} className="flex justify-between text-xs text-slate-700">
                <span>
                  <span className="font-medium capitalize">{ev.event_type.replace(/_/g, " ")}</span>
                  {" by "}
                  <span className="text-slate-500">{ev.actor ?? "system"}</span>
                </span>
                <span className="text-slate-400">
                  {new Date(ev.occurred_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Decision panel — only for in_review cases */}
      {c.status === "in_review" && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold">Record Decision</h2>
          <div className="mb-3 flex flex-wrap gap-2">
            {DECISIONS.map((d) => (
              <button
                key={d.value}
                onClick={() => setDecision(d.value)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                  decision === d.value
                    ? d.cls + " ring-2 ring-offset-1 ring-current"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
          <textarea
            placeholder="Rationale (required — min 10 characters, permanently auditable)"
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            rows={3}
            className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            disabled={!decision || rationale.trim().length < 10 || decideMutation.isPending}
            onClick={() => {
              if (decision && rationale.trim().length >= 10) {
                decideMutation.mutate({ decision, rationale: rationale.trim() });
              }
            }}
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {decideMutation.isPending ? "Submitting…" : "Submit Decision"}
          </button>
          {decideMutation.isError && (
            <p className="mt-2 text-sm text-red-600">Error — please try again.</p>
          )}
          {decideMutation.isSuccess && (
            <p className="mt-2 text-sm text-emerald-600">✓ Decision recorded.</p>
          )}
        </section>
      )}
    </div>
  );
}
