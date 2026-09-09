"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { QualitySummary } from "@/lib/types";
import { StatCard } from "@/components/shared/stat-card";
import { StatRowSkeleton, TableSkeleton } from "@/components/shared/loading-skeleton";
import { CaseStatusBadge } from "@/components/cases/case-status-badge";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { CheckCircle2Icon, AlertTriangleIcon, XCircleIcon } from "lucide-react";

export default function QualityPage() {
  const { data, isLoading } = useQuery<QualitySummary>({
    queryKey: ["quality"],
    queryFn: async () =>
      (await apiClient.get<QualitySummary>("/api/quality/summary")).data,
  });

  const total = data ? (data.total ?? (data.trusted + data.corrected + data.rejected)) : 0;
  const pct = (n: number) =>
    total > 0 ? `${((n / total) * 100).toFixed(1)}%` : "—";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Data Quality</h1>

      {isLoading ? (
        <StatRowSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatCard
            label="Trusted"
            value={data?.trusted ?? 0}
            sub={pct(data?.trusted ?? 0)}
            icon={CheckCircle2Icon}
            iconClass="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
          />
          <StatCard
            label="Corrected"
            value={data?.corrected ?? 0}
            sub={pct(data?.corrected ?? 0)}
            icon={AlertTriangleIcon}
            iconClass="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
          />
          <StatCard
            label="Rejected"
            value={data?.rejected ?? 0}
            sub={pct(data?.rejected ?? 0)}
            icon={XCircleIcon}
            iconClass="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
          />
        </div>
      )}

      {/* Recent events */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Recent Quality Events
        </h2>
        {isLoading ? (
          <TableSkeleton rows={5} cols={4} />
        ) : !data?.recent_events?.length ? (
          <div className="rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">
            No quality events recorded yet.
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Field</TableHead>
                  <TableHead>Issue Type</TableHead>
                  <TableHead>Case</TableHead>
                  <TableHead>Decision</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data.recent_events ?? []).map((ev) => (
                  <TableRow key={ev.id}>
                    <TableCell className="font-mono text-xs">
                      {ev.field_name?.replace(/_/g, " ")}
                    </TableCell>
                    <TableCell className="text-sm capitalize">
                      {ev.issue_type?.replace(/_/g, " ")}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {ev.case_id?.slice(0, 10) ?? "—"}
                    </TableCell>
                    <TableCell>
                      <CaseStatusBadge status={ev.decision} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(ev.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
