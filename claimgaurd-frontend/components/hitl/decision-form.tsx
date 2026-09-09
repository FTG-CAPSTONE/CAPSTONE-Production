"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type DecisionType = "approve" | "decline" | "escalate" | "request_docs";

const DECISION_CONFIG: Record<
  DecisionType,
  { label: string; btnClass: string }
> = {
  approve:      { label: "Approve",           btnClass: "bg-emerald-600 hover:bg-emerald-700 text-white" },
  decline:      { label: "Decline",           btnClass: "bg-red-600 hover:bg-red-700 text-white" },
  escalate:     { label: "Escalate",          btnClass: "bg-violet-600 hover:bg-violet-700 text-white" },
  request_docs: { label: "Request Documents", btnClass: "bg-amber-600 hover:bg-amber-700 text-white" },
};

interface DecisionFormProps {
  caseId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function DecisionForm({ caseId, open, onOpenChange }: DecisionFormProps) {
  const queryClient = useQueryClient();
  const [decision, setDecision] = useState<DecisionType | null>(null);
  const [rationale, setRationale] = useState("");

  const canSubmit = !!decision && rationale.trim().length >= 20;

  const { mutate, isPending } = useMutation({
    mutationFn: async () =>
      apiClient.post(
        `/api/cases/${caseId}/decision`,
        null,
        { params: { decision, rationale } },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case", caseId] });
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      queryClient.invalidateQueries({ queryKey: ["hitl-queue"] });
      toast.success("Decision recorded", {
        description: `Case ${caseId.slice(0, 8)} — ${DECISION_CONFIG[decision!].label}`,
      });
      onOpenChange(false);
      setDecision(null);
      setRationale("");
    },
    onError: () => {
      toast.error("Failed to record decision", {
        description: "Please try again.",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Decision</DialogTitle>
          <DialogDescription>
            Select an outcome and provide a mandatory rationale. This is
            permanently auditable and cannot be edited.
          </DialogDescription>
        </DialogHeader>

        {/* Decision selector */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          {(Object.entries(DECISION_CONFIG) as [DecisionType, (typeof DECISION_CONFIG)[DecisionType]][]).map(
            ([key, cfg]) => (
              <button
                key={key}
                type="button"
                onClick={() => setDecision(key)}
                className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${
                  decision === key
                    ? `${cfg.btnClass} ring-2 ring-offset-1 ring-current`
                    : "border-border bg-card hover:bg-muted"
                }`}
              >
                {cfg.label}
              </button>
            ),
          )}
        </div>

        {/* Rationale */}
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            Rationale{" "}
            <span className="text-xs text-muted-foreground font-normal">
              (min 20 characters)
            </span>
          </label>
          <textarea
            rows={3}
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            placeholder="Explain the basis for this decision…"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
          {rationale.length > 0 && rationale.length < 20 && (
            <p className="mt-1 text-xs text-destructive">
              {20 - rationale.length} more character{20 - rationale.length !== 1 ? "s" : ""} required
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={() => mutate()} disabled={!canSubmit || isPending}>
            {isPending ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Submitting…
              </>
            ) : (
              "Submit Decision"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
