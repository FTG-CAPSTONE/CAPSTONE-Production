"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckCircle2Icon, XCircleIcon, RefreshCwIcon,
  AlertTriangleIcon, Loader2Icon,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { fmtNumber, fmtPercent } from "@/lib/constants";
import type { MLOverview, ModelRegistryEntry, TrainingRunSummary, MLFeedbackItem } from "@/lib/types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { StatCard } from "@/components/shared/stat-card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { cn } from "@/lib/utils";

// ── Status chip ────────────────────────────────────────────────────────────
function ModelStatusBadge({ status }: { status: string }) {
  const classes: Record<string, string> = {
    champion:   "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    challenger: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    rejected:   "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    retired:    "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
    archived:   "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
    running:    "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    completed:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    failed:     "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  };
  return (
    <span className={cn(
      "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
      classes[status] ?? "bg-muted text-muted-foreground",
    )}>
      {status}
    </span>
  );
}

// ── Metric cell — highlights improvement vs champion ───────────────────────
function MetricCell({
  value, championValue, higherIsBetter = true,
}: {
  value: number | null;
  championValue?: number | null;
  higherIsBetter?: boolean;
}) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  const formatted = value.toFixed(3);
  if (championValue == null) return <span>{formatted}</span>;
  const delta = value - championValue;
  const isGood = higherIsBetter ? delta >= 0 : delta <= 0;
  return (
    <span className={cn("font-medium", delta !== 0 && (isGood ? "text-emerald-600" : "text-red-600"))}>
      {formatted}
      {delta !== 0 && (
        <span className="ml-1 text-xs opacity-70">
          ({delta > 0 ? "+" : ""}{delta.toFixed(3)})
        </span>
      )}
    </span>
  );
}

export default function MlAdminPage() {
  const queryClient = useQueryClient();
  const [retrainOpen, setRetrainOpen] = useState(false);

  const { data: overview, isLoading: ovLoading } = useQuery<MLOverview>({
    queryKey: ["ml-overview"],
    queryFn: async () => (await apiClient.get<MLOverview>("/api/ml/overview")).data,
  });
  const { data: registry = [], isLoading: regLoading } = useQuery<ModelRegistryEntry[]>({
    queryKey: ["ml-registry"],
    queryFn: async () => (await apiClient.get<ModelRegistryEntry[]>("/api/ml/model-registry")).data,
  });
  const { data: runs = [], isLoading: runsLoading } = useQuery<TrainingRunSummary[]>({
    queryKey: ["ml-runs"],
    queryFn: async () => (await apiClient.get<TrainingRunSummary[]>("/api/ml/training-runs")).data,
  });
  const { data: feedback = [], isLoading: fbLoading } = useQuery<MLFeedbackItem[]>({
    queryKey: ["ml-feedback"],
    queryFn: async () => (await apiClient.get<MLFeedbackItem[]>("/api/ml/feedback")).data,
  });

  const retrain = useMutation({
    mutationFn: async () => apiClient.post("/api/ml/retrain"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ml-registry"] });
      queryClient.invalidateQueries({ queryKey: ["ml-runs"] });
      toast.success("Retraining job triggered");
      setRetrainOpen(false);
    },
    onError: () => toast.error("Retrain failed"),
  });

  const promote = useMutation({
    mutationFn: async (id: string) => apiClient.patch(`/api/ml/model-registry/${id}/promote`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ml-overview"] });
      queryClient.invalidateQueries({ queryKey: ["ml-registry"] });
      toast.success("Model promoted to champion");
    },
    onError: () => toast.error("Promotion failed"),
  });

  const reject = useMutation({
    mutationFn: async (id: string) => apiClient.patch(`/api/ml/model-registry/${id}/reject`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ml-registry"] });
      toast.success("Model rejected");
    },
    onError: () => toast.error("Rejection failed"),
  });

  const rateFeedback = useMutation({
    mutationFn: async ({ id, rating }: { id: string; rating: "accurate" | "wrong" }) =>
      apiClient.post(`/api/ml/feedback`, { prediction_id: id, rating }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ml-feedback"] });
      toast.success("Feedback recorded");
    },
  });

  const champion = overview?.champion;
  const challengers = overview?.challengers_awaiting_review ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">ML Admin Portal</h1>
        <Button onClick={() => setRetrainOpen(true)} variant="outline" size="sm">
          <RefreshCwIcon className="size-3.5 mr-1.5" />
          Trigger Retrain
        </Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="feedback">
            Feedback Queue
            {feedback.filter((f) => !f.rated).length > 0 && (
              <Badge variant="destructive" className="ml-1.5 rounded-full text-[10px]">
                {feedback.filter((f) => !f.rated).length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="runs">Training Runs</TabsTrigger>
          <TabsTrigger value="registry">Registry</TabsTrigger>
        </TabsList>

        {/* ── Overview ── */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          {/* KPI tiles */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard
              label="Champion Model"
              value={champion?.version ?? "None"}
              sub={champion ? `F1: ${champion.f1_score?.toFixed(3) ?? "—"}` : "All cases → human review"}
            />
            <StatCard
              label="Challengers Pending"
              value={challengers.length}
              sub="Awaiting your review"
            />
            <StatCard
              label="Override Rate (30d)"
              value={overview?.override_rate_30d != null
                ? fmtPercent(overview.override_rate_30d)
                : "—"}
              sub="Human corrections vs model"
            />
            <StatCard
              label="Avg HITL Confidence"
              value={overview?.avg_confidence_hitl != null
                ? `${(Number(overview.avg_confidence_hitl) * 100).toFixed(0)}%`
                : "—"}
              sub="On routed-to-review cases"
            />
          </div>

          {/* No-champion warning */}
          {!champion && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
              <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <p className="text-sm text-amber-800 dark:text-amber-300">
                No champion model registered. All cases are routing to the human review queue
                until a model is trained and promoted.
              </p>
            </div>
          )}

          {/* Champion detail */}
          {champion && (
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-3">
                Champion Model
              </p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                {[
                  { label: "Version",   value: champion.version },
                  { label: "Algorithm", value: champion.algorithm },
                  { label: "Precision", value: champion.precision?.toFixed(3) },
                  { label: "Recall",    value: champion.recall?.toFixed(3) },
                  { label: "F1",        value: champion.f1_score?.toFixed(3) },
                  { label: "AUC-ROC",   value: champion.auc_roc?.toFixed(3) },
                  { label: "FPR",       value: champion.false_positive_rate?.toFixed(3) },
                  { label: "Trained Rows", value: fmtNumber(champion.trained_rows) },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-lg bg-muted/50 px-3 py-2">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-sm font-semibold mt-0.5">{value ?? "—"}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Challengers */}
          {challengers.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/10 p-5">
              <p className="text-xs uppercase tracking-wide text-amber-700 dark:text-amber-400 font-medium mb-3">
                Challengers Awaiting Review
              </p>
              <div className="space-y-2">
                {challengers.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-4 rounded-lg bg-background border border-border px-4 py-2.5">
                    <span className="text-sm font-medium">{m.version}</span>
                    <span className="text-xs text-muted-foreground">
                      F1: {m.f1_score?.toFixed(3) ?? "—"} · AUC: {m.auc_roc?.toFixed(3) ?? "—"}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => promote.mutate(m.id)}
                        disabled={promote.isPending}
                      >
                        Promote
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => reject.mutate(m.id)}
                        disabled={reject.isPending}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── Feedback Queue ── */}
        <TabsContent value="feedback" className="mt-4">
          {fbLoading ? (
            <TableSkeleton rows={5} cols={4} />
          ) : feedback.length === 0 ? (
            <div className="rounded-xl border border-border p-8 text-center text-sm text-muted-foreground">
              No feedback items in queue.
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Case ID</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feedback.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs">{item.case_id?.slice(0, 10)}…</TableCell>
                      <TableCell className="tabular-nums">{Number(item.score).toFixed(0)}</TableCell>
                      <TableCell className="tabular-nums">
                        {(Number(item.confidence) * 100).toFixed(0)}%
                      </TableCell>
                      <TableCell>
                        {item.rated ? (
                          <ModelStatusBadge status={item.rated} />
                        ) : (
                          <span className="text-xs text-muted-foreground">Unrated</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {!item.rated && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => rateFeedback.mutate({ id: item.prediction_id, rating: "accurate" })}
                              className="flex items-center gap-1 text-xs text-emerald-600 hover:underline"
                            >
                              <CheckCircle2Icon className="size-3" /> Accurate
                            </button>
                            <button
                              onClick={() => rateFeedback.mutate({ id: item.prediction_id, rating: "wrong" })}
                              className="flex items-center gap-1 text-xs text-red-600 hover:underline"
                            >
                              <XCircleIcon className="size-3" /> Wrong
                            </button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ── Training Runs ── */}
        <TabsContent value="runs" className="mt-4">
          {runsLoading ? (
            <TableSkeleton rows={5} cols={5} />
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Status</TableHead>
                    <TableHead>Rows Used</TableHead>
                    <TableHead>Fraud Rate</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Metrics</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                        No training runs yet. Click "Trigger Retrain" to start one.
                      </TableCell>
                    </TableRow>
                  )}
                  {runs.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell><ModelStatusBadge status={r.status} /></TableCell>
                      <TableCell className="tabular-nums">{fmtNumber(r.rows_used)}</TableCell>
                      <TableCell className="tabular-nums">
                        {r.fraud_rate != null ? fmtPercent(r.fraud_rate) : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.started_at ? new Date(r.started_at).toLocaleString() : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.completed_at ? new Date(r.completed_at).toLocaleString() : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">
                        {Object.entries(r.metrics ?? {})
                          .filter(([, v]) => v != null)
                          .map(([k, v]) => `${k}: ${Number(v).toFixed(3)}`)
                          .join(" · ") || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ── Registry ── */}
        <TabsContent value="registry" className="mt-4">
          {regLoading ? (
            <TableSkeleton rows={5} cols={8} />
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Version</TableHead>
                    <TableHead>Family</TableHead>
                    <TableHead>Algorithm</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Precision</TableHead>
                    <TableHead>Recall</TableHead>
                    <TableHead>F1</TableHead>
                    <TableHead>AUC</TableHead>
                    <TableHead>FPR</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registry.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-sm text-muted-foreground py-8">
                        No models in registry.
                      </TableCell>
                    </TableRow>
                  )}
                  {registry.map((m) => (
                    <TableRow key={m.id} className={m.status === "champion" ? "bg-emerald-50/30 dark:bg-emerald-950/10" : ""}>
                      <TableCell className="font-medium font-mono text-xs">{m.version}</TableCell>
                      <TableCell className="text-xs text-muted-foreground capitalize">
                        {m.model_family?.replace(/_/g, " ")}
                      </TableCell>
                      <TableCell className="text-xs">{m.algorithm}</TableCell>
                      <TableCell><ModelStatusBadge status={m.status} /></TableCell>
                      <TableCell>
                        <MetricCell value={m.precision} championValue={champion?.precision} />
                      </TableCell>
                      <TableCell>
                        <MetricCell value={m.recall} championValue={champion?.recall} />
                      </TableCell>
                      <TableCell>
                        <MetricCell value={m.f1_score} championValue={champion?.f1_score} />
                      </TableCell>
                      <TableCell>
                        <MetricCell value={m.auc_roc} championValue={champion?.auc_roc} />
                      </TableCell>
                      <TableCell>
                        <MetricCell
                          value={m.false_positive_rate ?? null}
                          championValue={champion?.false_positive_rate ?? null}
                          higherIsBetter={false}
                        />
                      </TableCell>
                      <TableCell>
                        {m.status === "challenger" && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => promote.mutate(m.id)}
                              disabled={promote.isPending}
                              className="text-xs font-medium text-emerald-600 hover:underline disabled:opacity-50"
                            >
                              Promote
                            </button>
                            <button
                              onClick={() => reject.mutate(m.id)}
                              disabled={reject.isPending}
                              className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Retrain confirm */}
      <ConfirmDialog
        open={retrainOpen}
        onOpenChange={setRetrainOpen}
        title="Trigger Model Retraining"
        description="This will queue a full retraining job using all labeled feedback. Training takes several minutes. The current champion remains active until you promote a new challenger."
        confirmLabel="Start Retraining"
        loading={retrain.isPending}
        onConfirm={() => retrain.mutate()}
      />
    </div>
  );
}
