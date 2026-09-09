"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon, FileTextIcon, DownloadIcon, AlertCircleIcon } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { fmtKES } from "@/lib/constants";
import type { CaseDetail, AuditEvent } from "@/lib/types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScoreGauge } from "@/components/intelligence/score-gauge";
import { ShapBarChart } from "@/components/intelligence/shap-bar-chart";
import { RuleFlagsList } from "@/components/intelligence/rule-flags-list";
import { AuditTimeline } from "@/components/intelligence/audit-timeline";
import { CaseStatusBadge } from "@/components/cases/case-status-badge";
import { RiskBadge } from "@/components/intelligence/risk-badge";
import { DecisionForm } from "@/components/hitl/decision-form";
import { CardSkeleton } from "@/components/shared/loading-skeleton";

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex justify-between py-2 border-b border-border last:border-0 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right max-w-xs">{value ?? "—"}</span>
    </div>
  );
}

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [decisionOpen, setDecisionOpen] = useState(false);

  const { data: c, isLoading } = useQuery<CaseDetail>({
    queryKey: ["case", id],
    queryFn: async () =>
      (await apiClient.get<CaseDetail>(`/api/cases/${id}`)).data,
  });

  const { data: auditEvents = [] } = useQuery<AuditEvent[]>({
    queryKey: ["audit", id],
    queryFn: async () =>
      (await apiClient.get<AuditEvent[]>("/api/audit", { params: { case_id: id } })).data,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <CardSkeleton lines={3} />
        <div className="grid gap-4 md:grid-cols-2">
          <CardSkeleton lines={6} />
          <CardSkeleton lines={6} />
        </div>
      </div>
    );
  }

  if (!c) {
    return (
      <div className="flex flex-col items-center gap-4 py-20">
        <AlertCircleIcon className="size-10 text-muted-foreground" />
        <p className="text-muted-foreground">Case not found.</p>
        <Button variant="outline" onClick={() => router.back()}>Go back</Button>
      </div>
    );
  }

  const latestPrediction = c.predictions?.[c.predictions.length - 1];
  const score = latestPrediction?.score ?? c.fraud_score;
  const band = latestPrediction?.band ?? c.fraud_band;
  const confidence = latestPrediction?.confidence ?? c.confidence;
  const allEvents = [
    ...(c.audit_events ?? []),
    ...auditEvents,
  ].filter(
    (e, i, arr) =>
      arr.findIndex((x) => x.occurred_at === e.occurred_at && x.event_type === e.event_type) === i,
  );

  const canDecide = ["in_review", "human_approve", "human_decline"].includes(c.status) ||
    (c.queue_item && c.queue_item.status !== "completed");

  return (
    <div className="flex flex-col gap-6">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground w-fit"
      >
        <ArrowLeftIcon className="size-3.5" />
        Back
      </button>

      {/* Case header */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold">{c.external_ref ?? c.id.slice(0, 12)}</h1>
              <CaseStatusBadge status={c.status} />
              <RiskBadge band={band} score={score} />
            </div>
            <p className="text-sm text-muted-foreground capitalize">
              {c.line_of_business?.replace(/_/g, " ")} ·{" "}
              {c.case_type ?? "claim"} ·{" "}
              {c.submitted_at
                ? `Submitted ${new Date(c.submitted_at).toLocaleDateString()}`
                : ""}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <p className="text-2xl font-semibold tabular-nums">{fmtKES(c.amount)}</p>
            {canDecide && (
              <Button onClick={() => setDecisionOpen(true)}>
                Record Decision
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="intelligence">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="intelligence">Intelligence</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="documents">
            Documents
            {(c.documents?.length ?? 0) > 0 && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs">
                {c.documents!.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* ── Intelligence tab ── */}
        <TabsContent value="intelligence" className="mt-4">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Score gauge */}
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-4">
                ML Risk Assessment
              </p>
              <div className="flex flex-col items-center gap-4">
                <ScoreGauge score={score} band={band} confidence={confidence} size={160} />
                {latestPrediction?.model_version && (
                  <p className="text-xs text-muted-foreground">
                    Model: {latestPrediction.model_version}
                  </p>
                )}
              </div>
            </div>

            {/* SHAP */}
            <div className="rounded-xl border border-border bg-card p-5">
              {latestPrediction ? (
                <ShapBarChart prediction={latestPrediction} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-sm text-muted-foreground gap-2">
                  <AlertCircleIcon className="size-6" />
                  No ML prediction recorded
                </div>
              )}
            </div>

            {/* Rules */}
            <div className="rounded-xl border border-border bg-card p-5 md:col-span-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-3">
                Rules Triggered
              </p>
              <RuleFlagsList rules={c.rules ?? []} />
            </div>
          </div>
        </TabsContent>

        {/* ── Details tab ── */}
        <TabsContent value="details" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Claimant */}
            {c.claimant && (
              <div className="rounded-xl border border-border bg-card p-5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-3">
                  Claimant
                </p>
                <DetailRow label="Name"   value={c.claimant.full_name} />
                <DetailRow label="ID No."  value={c.claimant.id_number} />
                <DetailRow label="Phone"   value={c.claimant.phone} />
                <DetailRow label="County"  value={c.claimant.county} />
              </div>
            )}
            {/* Policy */}
            {c.policy && (
              <div className="rounded-xl border border-border bg-card p-5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-3">
                  Policy
                </p>
                <DetailRow label="Policy ID"     value={c.policy.external_id ?? c.policy.id} />
                <DetailRow label="Product"       value={c.policy.product_line} />
                <DetailRow label="Motor Class"   value={c.policy.motor_class} />
                <DetailRow label="Sum Insured"   value={fmtKES(c.policy.sum_insured)} />
                <DetailRow label="Premium"       value={fmtKES(c.policy.premium)} />
                <DetailRow label="Status"        value={c.policy.status} />
                <DetailRow
                  label="Cover Period"
                  value={`${c.policy.start_date} → ${c.policy.end_date}`}
                />
              </div>
            )}
            {/* Incident from feature_snapshot */}
            {c.feature_snapshot && Object.keys(c.feature_snapshot).length > 0 && (
              <div className="rounded-xl border border-border bg-card p-5 md:col-span-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-3">
                  Feature Snapshot
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(c.feature_snapshot)
                    .slice(0, 12)
                    .map(([k, v]) => (
                      <div key={k} className="rounded-lg bg-muted/50 px-3 py-2">
                        <p className="text-xs text-muted-foreground capitalize">
                          {k.replace(/_/g, " ")}
                        </p>
                        <p className="text-sm font-medium mt-0.5 truncate">
                          {String(v)}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Documents tab ── */}
        <TabsContent value="documents" className="mt-4">
          <div className="rounded-xl border border-border bg-card">
            {!c.documents?.length ? (
              <div className="p-6">
                <p className="text-sm text-muted-foreground text-center">
                  No documents uploaded yet.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {c.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between px-5 py-3 gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {doc.original_filename}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {doc.doc_type.replace(/_/g, " ")} ·{" "}
                          {(doc.file_size_bytes / 1024).toFixed(0)} KB
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
        <Button asChild variant="outline" size="sm">
          <a href={doc.download_url} target="_blank" rel="noreferrer">
            View
          </a>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <a href={doc.download_url} download>
            <DownloadIcon className="size-3.5" />
          </a>
        </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── History tab ── */}
        <TabsContent value="history" className="mt-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <AuditTimeline events={allEvents} />
          </div>
        </TabsContent>
      </Tabs>

      {/* Decision form dialog */}
      <DecisionForm
        caseId={id}
        open={decisionOpen}
        onOpenChange={setDecisionOpen}
      />
    </div>
  );
}
