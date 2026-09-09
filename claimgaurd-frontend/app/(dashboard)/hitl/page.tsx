"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { UserPlusIcon, RefreshCwIcon } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { priorityColour, priorityRowClass, fmtKES, fmtNumber } from "@/lib/constants";
import type { ReviewQueueItem } from "@/lib/types";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { cn } from "@/lib/utils";

const REASON_OPTIONS = [
  { value: "",                label: "All reasons" },
  { value: "fraud_score",     label: "Fraud Score" },
  { value: "rule_flag",       label: "Rule Flag" },
  { value: "low_confidence",  label: "Low Confidence" },
  { value: "amount_threshold","label": "Amount Threshold" },
];

function PriorityBadge({ score }: { score: number }) {
  const safe = Number(score);
  const colour = priorityColour(safe);
  return (
    <span className={cn("text-sm font-bold tabular-nums", colour)}>
      {safe.toFixed(0)}
    </span>
  );
}

export default function HitlPage() {
  const queryClient = useQueryClient();
  const [reasonFilter, setReasonFilter] = useState("");

  const { data = [], isLoading, refetch, isFetching } = useQuery<ReviewQueueItem[]>({
    queryKey: ["hitl-queue"],
    queryFn: async () =>
      (await apiClient.get<ReviewQueueItem[]>("/api/hitl/queue")).data,
    refetchInterval: 60_000,
  });

  const assign = useMutation({
    mutationFn: async (id: string) =>
      apiClient.patch(`/api/hitl/queue/${id}/assign`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hitl-queue"] });
      toast.success("Assigned to you");
    },
    onError: () => toast.error("Assignment failed"),
  });

  const filtered = data
    .filter((item) =>
      !reasonFilter ||
      (item.reason ?? "").toLowerCase().includes(reasonFilter.toLowerCase()),
    )
    .sort((a, b) => Number(b.priority_score) - Number(a.priority_score));

  const pending = data.filter((i) => !i.status || i.status === "pending").length;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Review Queue</h1>
          {pending > 0 && (
            <Badge variant="destructive" className="rounded-full">
              {pending} pending
            </Badge>
          )}
        </div>
        <Button
          variant="outline" size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCwIcon className={cn("size-3.5 mr-1.5", isFetching && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <p className="text-sm text-muted-foreground -mt-2">
        Sorted by priority · combines fraud score, rule flags, and model confidence · auto-refreshes every 60s
      </p>

      {/* Filters */}
      <div className="flex gap-2">
        <select
          value={reasonFilter}
          onChange={(e) => setReasonFilter(e.target.value)}
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {REASON_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-20">Priority</TableHead>
                <TableHead>Case ID</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <EmptyState variant="queue-empty" />
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((item) => (
                <TableRow
                  key={item.id}
                  className={cn(
                    "transition-colors",
                    priorityRowClass(Number(item.priority_score)),
                  )}
                >
                  <TableCell>
                    <PriorityBadge score={Number(item.priority_score)} />
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {item.case_id?.slice(0, 10)}…
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground capitalize">
                    {item.reason?.replace(/_/g, " ") ?? "—"}
                  </TableCell>
                  <TableCell className="tabular-nums text-sm">
                    {item.amount != null ? fmtKES(item.amount) : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {item.assigned_to ? (
                      <span className="text-muted-foreground">{item.assigned_to}</span>
                    ) : (
                      <button
                        onClick={() => assign.mutate(item.id)}
                        disabled={assign.isPending}
                        className="flex items-center gap-1 text-primary hover:underline text-xs"
                      >
                        <UserPlusIcon className="size-3" />
                        Assign to me
                      </button>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      nativeButton={false}
                      render={<Link href={`/cases/${item.case_id}`} />}
                    >
                      Review →
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
