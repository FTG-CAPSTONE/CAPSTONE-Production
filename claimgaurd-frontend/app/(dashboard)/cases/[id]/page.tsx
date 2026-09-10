"use client";

import { useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Upload, ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { formatCurrency, formatDistanceToNow } from "@/lib/utils";
import type { CaseDetail, MLPrediction, AuditEvent, DocumentOut } from "@/lib/types";
// Import from our component structure — these are the rich versions with full functionality
import { ShapBarChart } from "@/components/intelligence/shap-bar-chart";
import { RuleFlagsList } from "@/components/intelligence/rule-flags-list";
import { ScoreGauge } from "@/components/intelligence/score-gauge";
import { CaseStatusBadge } from "@/components/cases/case-status-badge";
import { RiskBadge } from "@/components/intelligence/risk-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader,
  DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

// Decisions accepted by POST /api/cases/{case_id}/decision
const DECISIONS = [
  { value: "approved",     label: "Approve",       className: "bg-emerald-600 hover:bg-emerald-700 text-white" },
  { value: "declined",     label: "Decline",       className: "bg-red-600 hover:bg-red-700 text-white" },
  { value: "escalated",    label: "Escalate",      className: "bg-violet-600 hover:bg-violet-700 text-white" },
  { value: "request_docs", label: "Request Docs",  className: "border-amber-500 text-amber-600 hover:bg-amber-50 border" },
] as const;

type DecisionValue = (typeof DECISIONS)[number]["value"];

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [decision, setDecision] = useState<DecisionValue | "">("");
  const [rationale, setRationale] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: c, isLoading } = useQuery<CaseDetail>({
    queryKey: ["case", id],
    queryFn: async () => (await apiClient.get<CaseDetail>(`/api/cases/${id}`)).data,
  });

  // Separate ML prediction endpoint with full SHAP
  const { data: prediction } = useQuery<MLPrediction | null>({
    queryKey: ["ml-prediction", id],
    queryFn: async () => {
      try {
        return (await apiClient.get<MLPrediction>(`/api/ml/predictions/${id}`)).data;
      } catch { return null; }
    },
    enabled: !!id,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const decideMutation = useMutation({
    mutationFn: async ({ decision, rationale }: { decision: DecisionValue; rationale: string }) =>
      apiClient.post(`/api/cases/${id}/decision`, { decision, rationale }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case", id] });
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      queryClient.invalidateQueries({ queryKey: ["hitl-queue"] });
      setDecision("");
      setRationale("");
      setDialogOpen(false);
      toast.success("Decision recorded successfully");
    },
    onError: () => toast.error("Failed to submit decision. Please try again."),
  });

  async function handleExport() {
    try {
      const res = await apiClient.get(`/api/cases/${id}/evidence-export`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `evidence-${id?.slice(0, 8)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Evidence exported");
    } catch { toast.error("Export failed."); }
  }

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
      toast.success("Document uploaded");
    } catch {
      setUploadStatus("error");
      toast.error("Upload failed.");
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (isLoading || !c) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  const fraudScore = c.fraud_score ? parseFloat(String(c.fraud_score)) : null;
  const rules      = c.rule_evaluations ?? c.rules ?? [];
  const flaggedRules = rules.filter((r) => r.result !== "pass" && r.passed !== "pass");

  // Build a MLPredictionSummary-compatible object for ScoreGauge + ShapBarChart
  const shapPrediction = prediction
    ? {
        score: fraudScore ?? 0,
        band: prediction.band ?? c.fraud_band ?? "low",
        confidence: prediction.confidence ? parseFloat(String(prediction.confidence)) : null,
        top_features: (prediction.shap_values ?? []).map((f) => ({
          feature: f.feature,
          impact: f.impact ?? f.raw_shap,
          value: f.value,
          direction: f.direction,
          note: f.note,
        })),
        note: prediction.note ?? undefined,
        model_version: prediction.model_version ?? undefined,
      }
    : c.predictions?.[c.predictions.length - 1] ?? null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <button
            onClick={() => router.back()}
            className="mb-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold">
              {c.external_claim_id ?? c.external_ref ?? c.id.slice(0, 8)}
            </h1>
            <CaseStatusBadge status={c.status} />
            <RiskBadge band={c.fraud_band} score={fraudScore} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {c.claim_type?.replace(/_/g, " ") ?? c.line_of_business} ·{" "}
            {formatCurrency(c.amount_claimed ?? c.amount ?? null)} ·{" "}
            Submitted {formatDistanceToNow(c.submitted_at)}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>

          {/* Decision dialog */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger render={<Button size="sm" />}>
              Make Decision
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Record Decision</DialogTitle>
                <DialogDescription>
                  Select a decision and provide rationale (min 20 chars). This action is permanently auditable.
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-2 mt-2">
                {DECISIONS.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => setDecision(d.value)}
                    className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-all
                      ${decision === d.value
                        ? `${d.className} ring-2 ring-offset-1 ring-current`
                        : "border border-border hover:bg-muted"
                      }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              <Textarea
                placeholder="Rationale (minimum 20 characters, permanently recorded)…"
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                className="mt-2"
                rows={3}
              />
              {rationale.length > 0 && rationale.length < 20 && (
                <p className="text-xs text-destructive">
                  {20 - rationale.length} more character{20 - rationale.length !== 1 ? "s" : ""} required
                </p>
              )}

              <div className="flex justify-end gap-2 mt-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => { if (decision) decideMutation.mutate({ decision, rationale }); }}
                  disabled={!decision || rationale.trim().length < 20 || decideMutation.isPending}
                >
                  {decideMutation.isPending ? "Submitting…" : "Submit Decision"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="intelligence">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="intelligence">Intelligence</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="documents">
            Documents
            {c.documents.length > 0 && (
              <Badge className="ml-1.5 rounded-full text-[10px] h-4 px-1.5">
                {c.documents.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Intelligence Tab */}
        <TabsContent value="intelligence" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Score gauge */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Fraud Risk Score</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center">
                <ScoreGauge
                  score={fraudScore}
                  band={prediction?.band ?? c.fraud_band}
                  confidence={prediction?.confidence != null ? parseFloat(String(prediction.confidence)) : null}
                  size={160}
                />
                {shapPrediction?.model_version && (
                  <p className="mt-2 text-xs text-muted-foreground">Model: {shapPrediction.model_version}</p>
                )}
              </CardContent>
            </Card>

            {/* SHAP */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">ML Explanation (SHAP)</CardTitle>
              </CardHeader>
              <CardContent>
                {shapPrediction && (shapPrediction.top_features?.length > 0 || shapPrediction.note) ? (
                  <ShapBarChart prediction={shapPrediction} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No SHAP explanation available for this case.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Rules */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                Rule Evaluations
                {flaggedRules.length > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {flaggedRules.length} flag{flaggedRules.length !== 1 ? "s" : ""}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RuleFlagsList rules={rules} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Details Tab */}
        <TabsContent value="details" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Case Information</CardTitle></CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ["Claim Type",       c.claim_type?.replace(/_/g, " ") ?? "—"],
                    ["Line of Business", c.line_of_business],
                    ["Currency",         c.currency],
                    ["Amount Claimed",   formatCurrency(c.amount_claimed ?? c.amount ?? null)],
                    ["Amount Approved",  formatCurrency(c.amount_approved)],
                    ["Incident Date",    c.incident_date ?? "—"],
                    ["Reported Date",    c.reported_date ?? "—"],
                    ["Submitted",        new Date(c.submitted_at).toLocaleDateString()],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="font-medium capitalize">{value}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Policy Details</CardTitle></CardHeader>
              <CardContent>
                {c.policy ? (
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    {[
                      ["Policy ID",    c.policy.external_id ?? "—"],
                      ["Product",      c.policy.product_line],
                      ["Motor Class",  c.policy.motor_class ?? "—"],
                      ["Sum Insured",  formatCurrency(c.policy.sum_insured)],
                      ["Start Date",   c.policy.start_date],
                      ["End Date",     c.policy.end_date],
                      ["Status",       c.policy.status],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-xs text-muted-foreground">{label}</dt>
                        <dd className="font-medium capitalize">{value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : <p className="text-sm text-muted-foreground">No policy linked.</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Claimant</CardTitle></CardHeader>
              <CardContent>
                {c.claimant ? (
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    {[
                      ["Name",      c.claimant.full_name],
                      ["ID Number", c.claimant.id_number ?? "—"],
                      ["Phone",     c.claimant.phone ?? "—"],
                      ["County",    c.claimant.county ?? "—"],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-xs text-muted-foreground">{label}</dt>
                        <dd className="font-medium">{value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : <p className="text-sm text-muted-foreground">No claimant information.</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Service Provider</CardTitle></CardHeader>
              <CardContent>
                {c.provider ? (
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    {[
                      ["Name",      c.provider.full_name],
                      ["ID Number", c.provider.id_number ?? "—"],
                      ["Phone",     c.provider.phone ?? "—"],
                      ["County",    c.provider.county ?? "—"],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-xs text-muted-foreground">{label}</dt>
                        <dd className="font-medium">{value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : <p className="text-sm text-muted-foreground">No provider information.</p>}
              </CardContent>
            </Card>
          </div>

          {/* Feature snapshot fallback */}
          {(c.segment_data ?? c.feature_snapshot) && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Feature Snapshot</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {Object.entries(c.segment_data ?? c.feature_snapshot ?? {}).slice(0, 12).map(([k, v]) => (
                    <div key={k} className="rounded-lg bg-muted/50 px-3 py-2">
                      <p className="text-xs text-muted-foreground capitalize">{k.replace(/_/g, " ")}</p>
                      <p className="text-sm font-medium mt-0.5 truncate">{String(v)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  Attached Documents ({c.documents.length})
                </CardTitle>
                <div>
                  <input ref={fileInputRef} type="file" className="hidden"
                    onChange={handleUpload} accept=".pdf,.png,.jpg,.jpeg,.docx" />
                  <Button variant="outline" size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadStatus === "uploading"}>
                    <Upload className="h-4 w-4 mr-1" />
                    {uploadStatus === "uploading" ? "Uploading…" : "Upload"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {c.documents.length === 0 ? (
                <EmptyState variant="no-data" title="No documents"
                  body="Upload supporting documents for this case." />
              ) : (
                <div className="divide-y divide-border">
                  {c.documents.map((doc) => <DocRow key={doc.id} doc={doc} caseId={c.id} />)}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Audit Trail</CardTitle>
            </CardHeader>
            <CardContent>
              {c.audit_events.length === 0 ? (
                <EmptyState variant="no-data" title="No history"
                  body="Activity will appear here as actions are taken." />
              ) : (
                <div className="relative">
                  <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />
                  <div className="space-y-4">
                    {c.audit_events.map((event, i) => (
                      <AuditRow key={event.id ?? i} event={event} />
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DocRow({ doc, caseId }: { doc: DocumentOut; caseId: string }) {
  const fileSize = doc.file_size_bytes
    ? doc.file_size_bytes < 1024 ? `${doc.file_size_bytes} B`
    : doc.file_size_bytes < 1024 * 1024 ? `${(doc.file_size_bytes / 1024).toFixed(1)} KB`
    : `${(doc.file_size_bytes / (1024 * 1024)).toFixed(1)} MB`
    : null;

  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-muted p-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">{doc.original_filename ?? doc.id.slice(0, 12)}</p>
          <p className="text-xs text-muted-foreground">
            <span className="capitalize">{doc.doc_type.replace(/_/g, " ")}</span>
            {fileSize && ` · ${fileSize}`}
            {doc.uploaded_at && ` · ${formatDistanceToNow(doc.uploaded_at)}`}
          </p>
        </div>
      </div>
      <a
        href={doc.download_url ?? `/api/cases/${caseId}/documents/${doc.id}/download`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center rounded-lg h-8 w-8 hover:bg-muted transition-colors"
      >
        <Download className="h-4 w-4" />
      </a>
    </div>
  );
}

function AuditRow({ event }: { event: AuditEvent }) {
  const EVENT_LABELS: Record<string, string> = {
    case_ingested:      "Case ingested",
    etl_completed:      "ETL completed",
    ml_scored:          "ML scoring completed",
    decision_recorded:  "Decision recorded",
    auto_approved:      "Case auto-approved",
    auto_rejected:      "Case auto-rejected",
    routed_to_hitl:     "Routed to review queue",
    document_uploaded:  "Document uploaded",
    case_opened:        "Case opened for review",
  };
  return (
    <div className="relative pl-8">
      <div className="absolute left-1.5 top-1.5 h-3 w-3 rounded-full border-2 border-background bg-muted" />
      <p className="text-sm font-medium">
        {EVENT_LABELS[event.event_type] ?? event.event_type.replace(/_/g, " ")}
      </p>
      <p className="text-xs text-muted-foreground">
        {event.actor && event.actor !== "system" && `by ${event.actor} · `}
        {new Date(event.occurred_at).toLocaleString()}
      </p>
    </div>
  );
}
