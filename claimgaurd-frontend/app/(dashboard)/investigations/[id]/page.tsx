"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeftIcon, AlertCircleIcon, SaveIcon, CheckIcon,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { Investigation, CaseSummary } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CardSkeleton } from "@/components/shared/loading-skeleton";
import { cn } from "@/lib/utils";

const OUTCOME_OPTIONS = [
  { value: "fraud_confirmed", label: "Fraud Confirmed" },
  { value: "legitimate",      label: "Legitimate" },
  { value: "inconclusive",    label: "Inconclusive" },
];

export default function InvestigationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [note, setNote] = useState("");
  const [outcome, setOutcome] = useState("");
  const [closeOpen, setCloseOpen] = useState(false);

  const { data: inv, isLoading } = useQuery<Investigation>({
    queryKey: ["investigation", id],
    queryFn: async () =>
      (await apiClient.get<Investigation>(`/api/hitl/investigations/${id}`)).data,
  });

  const { data: caseData } = useQuery<CaseSummary>({
    queryKey: ["case-summary", inv?.case_id],
    enabled: !!inv?.case_id,
    queryFn: async () =>
      (await apiClient.get<CaseSummary>(`/api/cases/${inv!.case_id}`)).data,
  });

  const addNote = useMutation({
    mutationFn: async () =>
      apiClient.patch(`/api/hitl/investigations/${id}`, { notes: note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investigation", id] });
      toast.success("Note saved");
      setNote("");
    },
    onError: () => toast.error("Failed to save note"),
  });

  const closeInv = useMutation({
    mutationFn: async () =>
      apiClient.post(`/api/hitl/investigations/${id}/close`, { outcome }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investigation", id] });
      queryClient.invalidateQueries({ queryKey: ["investigations"] });
      toast.success("Investigation closed");
      setCloseOpen(false);
    },
    onError: () => toast.error("Failed to close investigation"),
  });

  if (isLoading) return (
    <div className="space-y-4">
      <CardSkeleton lines={3} />
      <CardSkeleton lines={6} />
    </div>
  );

  if (!inv) return (
    <div className="flex flex-col items-center gap-4 py-20">
      <AlertCircleIcon className="size-10 text-muted-foreground" />
      <p className="text-muted-foreground">Investigation not found.</p>
      <Button variant="outline" onClick={() => router.back()}>Go back</Button>
    </div>
  );

  const isOpen = inv.status === "open" || inv.status === "in_progress";

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground w-fit"
      >
        <ArrowLeftIcon className="size-3.5" />
        Back to Investigations
      </button>

      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">
              Investigation #{inv.id.slice(0, 8)}
            </h1>
            <p className="text-sm text-muted-foreground">
              Case:{" "}
              <a href={`/cases/${inv.case_id}`} className="text-primary hover:underline font-mono text-xs">
                {inv.case_id.slice(0, 12)}
              </a>
              {" · "}Investigator: {inv.investigator_name}
              {" · "}Opened: {new Date(inv.opened_at).toLocaleDateString()}
            </p>
          </div>
          <span className={cn(
            "inline-flex rounded-full px-3 py-1 text-xs font-medium capitalize",
            {
              "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300": inv.status === "open",
              "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300": inv.status === "in_progress",
              "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300": inv.status === "closed",
              "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300": inv.status === "referred_to_ira",
            },
          )}>
            {inv.status.replace(/_/g, " ")}
          </span>
        </div>
      </div>

      {/* Case summary */}
      {caseData && (
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-3">
            Case Summary
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: "Reference", value: caseData.external_ref },
              { label: "LOB",       value: caseData.line_of_business?.replace(/_/g, " ") },
              { label: "Amount",    value: `KES ${(caseData.amount ?? 0).toLocaleString()}` },
              { label: "Status",    value: caseData.status?.replace(/_/g, " ") },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg bg-muted/50 px-3 py-2">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-sm font-medium mt-0.5 capitalize">{value ?? "—"}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Existing notes */}
      {inv.notes && (
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-3">
            Investigation Notes
          </p>
          <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">
            {inv.notes}
          </pre>
        </div>
      )}

      {/* Add note */}
      {isOpen && (
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-3">
            Add Note
          </p>
          <textarea
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Document your findings, contacts made, evidence reviewed…"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
          <div className="mt-2 flex justify-end">
            <Button
              size="sm"
              onClick={() => addNote.mutate()}
              disabled={!note.trim() || addNote.isPending}
            >
              <SaveIcon className="size-3.5 mr-1.5" />
              Save Note
            </Button>
          </div>
        </div>
      )}

      {/* Close investigation */}
      {isOpen && (
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-3">
            Close Investigation
          </p>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {OUTCOME_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => setOutcome(o.value)}
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-sm font-medium transition-all",
                  outcome === o.value
                    ? "border-primary bg-primary/5 text-primary ring-2 ring-primary/30"
                    : "border-border hover:bg-muted",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          <Button
            onClick={() => setCloseOpen(true)}
            disabled={!outcome}
            variant="destructive"
            size="sm"
          >
            <CheckIcon className="size-3.5 mr-1.5" />
            Close Investigation
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={closeOpen}
        onOpenChange={setCloseOpen}
        title="Close Investigation"
        description={`Outcome: ${OUTCOME_OPTIONS.find((o) => o.value === outcome)?.label ?? outcome}. This action is permanent and cannot be undone.`}
        confirmLabel="Confirm Close"
        variant="destructive"
        loading={closeInv.isPending}
        onConfirm={() => closeInv.mutate()}
      />
    </div>
  );
}
