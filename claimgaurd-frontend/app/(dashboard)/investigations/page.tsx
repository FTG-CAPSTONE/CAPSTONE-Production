"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import type { Investigation } from "@/lib/types";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { cn } from "@/lib/utils";

const STATUS_CLASSES: Record<string, string> = {
  open:           "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  in_progress:    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  closed:         "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  referred_to_ira:"bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
};

const OUTCOME_CLASSES: Record<string, string> = {
  fraud_confirmed: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  legitimate:      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  inconclusive:    "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

export default function InvestigationsPage() {
  const { data = [], isLoading } = useQuery<Investigation[]>({
    queryKey: ["investigations"],
    queryFn: async () =>
      (await apiClient.get<Investigation[]>("/api/investigations")).data,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Investigations</h1>
        <span className="text-sm text-muted-foreground">{data.length} total</span>
      </div>
      <p className="text-sm text-muted-foreground -mt-2">
        Escalated cases under active investigation.
      </p>

      {isLoading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>ID</TableHead>
                <TableHead>Case</TableHead>
                <TableHead>Investigator</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Opened</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <EmptyState variant="no-data" title="No investigations" body="Escalated cases will appear here." />
                  </TableCell>
                </TableRow>
              )}
              {data.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono text-xs">{inv.id.slice(0, 10)}…</TableCell>
                  <TableCell className="font-mono text-xs">
                    <Link href={`/cases/${inv.case_id}`} className="text-primary hover:underline">
                      {inv.case_id.slice(0, 10)}…
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{inv.investigator_name}</TableCell>
                  <TableCell>
                    <span className={cn(
                      "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                      STATUS_CLASSES[inv.status] ?? "bg-muted text-muted-foreground",
                    )}>
                      {inv.status.replace(/_/g, " ")}
                    </span>
                  </TableCell>
                  <TableCell>
                    {inv.outcome ? (
                      <span className={cn(
                        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                        OUTCOME_CLASSES[inv.outcome] ?? "bg-muted text-muted-foreground",
                      )}>
                        {inv.outcome.replace(/_/g, " ")}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Pending</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(inv.opened_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/investigations/${inv.id}`}
                      className="text-xs text-primary hover:underline"
                    >
                      Open →
                    </Link>
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
