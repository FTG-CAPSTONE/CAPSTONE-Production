"use client";

import { useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Download,
  Upload,
  ArrowLeft,
  FileText,
  Clock,
  Brain,
  Info,
  File,
  History,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { CaseDetail, MLPrediction, AuditEvent, DocumentOut } from "@/lib/types";
import { ShapExplanation } from "@/components/shap-explanation";
import { RuleFlagsList } from "@/components/rule-flags-list";
import { ScoreGauge } from "@/components/score-gauge";
import { StatusBadge } from "@/components/status-badge";
import { RiskBadge } from "@/components/risk-badge";
import { EmptyState } from "@/components/empty-state";
import { formatCurrency, formatDistanceToNow } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

// Decisions accepted by POST /api/cases/{case_id}/decision
const DECISIONS = [
  { value: "approved", label: "Approve", variant: "default" as const, className: "bg-green-600 hover:bg-green-700" },
  { value: "declined", label: "Decline", variant: "destructive" as const, className: "" },
  { value: "escalated", label: "Escalate", variant: "secondary" as const, className: "bg-purple-600 hover:bg-purple-700 text-white" },
  { value: "request_docs", label: "Request Docs", variant: "outline" as const, className: "border-amber-500 text-amber-600 hover:bg-amber-50" },
] as const;

type DecisionValue = (typeof DECISIONS)[number]["value"];

// ── component ─────────────────────────────────────────────────────────────────

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [decision, setDecision] = useState<DecisionValue | "">("");
  const [rationale, setRationale] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
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
    onError: () => {
      toast.error("Failed to submit decision. Please try again.");
    },
  });

  async function handleExport() {
    try {
      const res = await apiClient.get(`/api/cases/${id}/evidence-export`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `evidence-${id?.slice(0, 8)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Evidence exported successfully");
    } catch {
      toast.error("Export failed. Please try again.");
    }
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
      toast.success("Document uploaded successfully");
    } catch {
      setUploadStatus("error");
      toast.error("Upload failed. Please try again.");
    }
  }

  function handleDecisionSubmit() {
    if (decision && rationale.trim().length >= 20) {
      decideMutation.mutate({ decision, rationale: rationale.trim() });
    }
  }

  // ── render ───────────────────────────────────────────────────────────────────

  if (isLoading || !c) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  const fraudScore = c.fraud_score ? parseFloat(c.fraud_score) : 0;
  const flaggedRules = c.rule_evaluations.filter((r) => r.result !== "pass");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">
              {c.external_claim_id ?? c.id.slice(0, 8)}
            </h1>
            <StatusBadge status={c.status} />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {c.claim_type?.replace(/_/g, " ") ?? c.line_of_business} · {formatCurrency(c.amount_claimed)} · Submitted {formatDistanceToNow(c.submitted_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
          {c.status === "in_review" && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger>
                <Button size="sm">Make Decision</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Record Decision</DialogTitle>
                  <DialogDescription>
                    Select a decision and provide rationale. This action is permanently auditable.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="flex flex-wrap gap-2">
                    {DECISIONS.map((d) => (
                      <Button
                        key={d.value}
                        variant={decision === d.value ? "default" : "outline"}
                        size="sm"
                        className={decision === d.value ? d.className : ""}
                        onClick={() => setDecision(d.value)}
                      >
                        {d.label}
                      </Button>
                    ))}
                  </div>
                  <div>
                    <Textarea
                      placeholder="Rationale (minimum 20 characters)..."
                      value={rationale}
                      onChange={(e) => setRationale(e.target.value)}
                      rows={4}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {rationale.length}/20 characters minimum
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleDecisionSubmit}
                    disabled={!decision || rationale.trim().length < 20 || decideMutation.isPending}
                  >
                    {decideMutation.isPending ? "Submitting..." : "Submit Decision"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Tabbed Content */}
      <Tabs defaultValue="intelligence" className="space-y-4">
        <TabsList>
          <TabsTrigger value="intelligence" className="gap-1.5">
            <Brain className="h-4 w-4" />
            Intelligence
          </TabsTrigger>
          <TabsTrigger value="details" className="gap-1.5">
            <Info className="h-4 w-4" />
            Details
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-1.5">
            <File className="h-4 w-4" />
            Documents
            {c.documents.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                {c.documents.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        {/* Intelligence Tab */}
        <TabsContent value="intelligence" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Score Gauge */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Fraud Score</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center">
                <ScoreGauge score={fraudScore} band={c.fraud_band} size="lg" />
              </CardContent>
            </Card>

            {/* Metrics */}
            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Risk Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Risk Band</p>
                    <div className="mt-1">
                      <RiskBadge band={c.fraud_band} />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Confidence</p>
                    <p className="text-lg font-semibold">
                      {c.confidence ? `${(parseFloat(c.confidence) * 100).toFixed(0)}%` : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Complexity</p>
                    <p className="text-lg font-semibold">
                      {c.complexity_score ? `${parseFloat(c.complexity_score).toFixed(0)}/100` : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Rule Flags</p>
                    <p className="text-lg font-semibold">
                      {flaggedRules.length > 0 ? (
                        <span className="text-amber-600">{flaggedRules.length} flags</span>
                      ) : (
                        <span className="text-green-600">None</span>
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* SHAP Explanation */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">ML Explanation</CardTitle>
            </CardHeader>
            <CardContent>
              {prediction?.shap_values?.length ? (
                <ShapExplanation features={prediction.shap_values} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {prediction?.note ?? "No SHAP explanation available for this case."}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Rule Evaluations */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                Rule Evaluations
                {flaggedRules.length > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {flaggedRules.length} flag{flaggedRules.length > 1 ? "s" : ""}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RuleFlagsList rules={c.rule_evaluations} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Case Information */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Case Information</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ["Claim Type", c.claim_type?.replace(/_/g, " ") ?? "—"],
                    ["Line of Business", c.line_of_business],
                    ["Currency", c.currency],
                    ["Amount Claimed", formatCurrency(c.amount_claimed)],
                    ["Amount Approved", formatCurrency(c.amount_approved)],
                    ["Incident Date", c.incident_date ?? "—"],
                    ["Reported Date", c.reported_date ?? "—"],
                    ["Submitted", new Date(c.submitted_at).toLocaleDateString()],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="font-medium capitalize">{value}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>

            {/* Policy Information */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Policy Details</CardTitle>
              </CardHeader>
              <CardContent>
                {c.policy ? (
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    {[
                      ["Policy ID", c.policy.external_id ?? "—"],
                      ["Product Line", c.policy.product_line],
                      ["Motor Class", c.policy.motor_class ?? "—"],
                      ["Sum Insured", formatCurrency(c.policy.sum_insured)],
                      ["Start Date", c.policy.start_date],
                      ["End Date", c.policy.end_date],
                      ["Status", c.policy.status],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-xs text-muted-foreground">{label}</dt>
                        <dd className="font-medium capitalize">{value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-sm text-muted-foreground">No policy linked to this case.</p>
                )}
              </CardContent>
            </Card>

            {/* Claimant Information */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Claimant</CardTitle>
              </CardHeader>
              <CardContent>
                {c.claimant ? (
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    {[
                      ["Name", c.claimant.full_name],
                      ["ID Number", c.claimant.id_number ?? "—"],
                      ["Phone", c.claimant.phone ?? "—"],
                      ["County", c.claimant.county ?? "—"],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-xs text-muted-foreground">{label}</dt>
                        <dd className="font-medium">{value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-sm text-muted-foreground">No claimant information available.</p>
                )}
              </CardContent>
            </Card>

            {/* Provider Information */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Service Provider</CardTitle>
              </CardHeader>
              <CardContent>
                {c.provider ? (
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    {[
                      ["Name", c.provider.full_name],
                      ["ID Number", c.provider.id_number ?? "—"],
                      ["Phone", c.provider.phone ?? "—"],
                      ["County", c.provider.county ?? "—"],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-xs text-muted-foreground">{label}</dt>
                        <dd className="font-medium">{value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-sm text-muted-foreground">No provider information available.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Notes */}
          {c.notes && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{c.notes}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  Attached Documents ({c.documents.length})
                </CardTitle>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleUpload}
                    accept=".pdf,.png,.jpg,.jpeg,.docx"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadStatus === "uploading"}
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    {uploadStatus === "uploading" ? "Uploading..." : "Upload"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {c.documents.length === 0 ? (
                <EmptyState
                  variant="no-data"
                  title="No documents"
                  description="Upload supporting documents for this case."
                />
              ) : (
                <div className="divide-y">
                  {c.documents.map((doc) => (
                    <DocumentRow key={doc.id} doc={doc} caseId={c.id} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Audit Trail</CardTitle>
            </CardHeader>
            <CardContent>
              {c.audit_events.length === 0 ? (
                <EmptyState
                  variant="no-data"
                  title="No history"
                  description="Activity will appear here as actions are taken on this case."
                />
              ) : (
                <div className="relative">
                  <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />
                  <div className="space-y-4">
                    {c.audit_events.map((event, idx) => (
                      <AuditEventRow key={event.id ?? idx} event={event} />
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

// Sub-components

function DocumentRow({ doc, caseId }: { doc: DocumentOut; caseId: string }) {
  const fileSize = doc.file_size_bytes
    ? doc.file_size_bytes < 1024
      ? `${doc.file_size_bytes} B`
      : doc.file_size_bytes < 1024 * 1024
        ? `${(doc.file_size_bytes / 1024).toFixed(1)} KB`
        : `${(doc.file_size_bytes / (1024 * 1024)).toFixed(1)} MB`
    : null;

  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-muted p-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">
            {doc.original_filename ?? doc.id.slice(0, 12)}
          </p>
          <p className="text-xs text-muted-foreground">
            <span className="capitalize">{doc.doc_type.replace(/_/g, " ")}</span>
            {fileSize && ` · ${fileSize}`}
            {doc.uploaded_at && ` · ${formatDistanceToNow(doc.uploaded_at)}`}
          </p>
        </div>
      </div>
            <Link
        href={`/api/cases/${caseId}/documents/${doc.id}/download`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center rounded-lg h-8 w-8 hover:bg-muted transition-colors"
      >
        <Download className="h-4 w-4" />
      </Link>
    </div>
  );
}

function AuditEventRow({ event }: { event: AuditEvent }) {
  const eventLabels: Record<string, string> = {
    case_created: "Case created",
    case_scored: "ML scoring completed",
    case_approved: "Case approved",
    case_declined: "Case declined",
    case_reviewed: "Case reviewed",
    decision_made: "Decision recorded",
    document_uploaded: "Document uploaded",
    status_changed: "Status changed",
  };

  return (
    <div className="relative pl-8">
      <div className="absolute left-1.5 top-1.5 h-3 w-3 rounded-full border-2 border-background bg-muted" />
      <div>
        <p className="text-sm font-medium">
          {eventLabels[event.event_type] ?? event.event_type.replace(/_/g, " ")}
        </p>
        <p className="text-xs text-muted-foreground">
          {event.actor && <span>by {event.actor} · </span>}
          {new Date(event.occurred_at).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
