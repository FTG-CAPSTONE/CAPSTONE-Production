"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDownIcon, ChevronRightIcon, SearchIcon } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { fmtKES } from "@/lib/constants";
import type { CaseSummary } from "@/lib/types";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { CaseStatusBadge } from "@/components/cases/case-status-badge";
import { RiskBadge } from "@/components/intelligence/risk-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { TableSkeleton } from "@/components/shared/loading-skeleton";

const STATUS_OPTIONS = [
  { value: "",                label: "All statuses" },
  { value: "in_review",       label: "In Review" },
  { value: "auto_approved",   label: "Auto Approved" },
  { value: "auto_rejected",   label: "Auto Rejected" },
  { value: "approved",        label: "Approved" },
  { value: "declined",        label: "Declined" },
  { value: "received",        label: "Received" },
  { value: "processing",      label: "Processing" },
];

const LOB_OPTIONS = [
  { value: "",             label: "All lines" },
  { value: "motor",        label: "Motor" },
  { value: "health",       label: "Health" },
  { value: "marine_cargo", label: "Marine Cargo" },
  { value: "general",      label: "General" },
];

type SortKey = "submitted_at" | "amount" | "fraud_score";

export default function CasesPage() {
  const [status, setStatus] = useState("");
  const [lob, setLob] = useState("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("submitted_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const { data: allCases = [], isLoading } = useQuery<CaseSummary[]>({
    queryKey: ["cases", status, lob],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (status) params.status = status;
      if (lob)    params.line_of_business = lob;
      return (await apiClient.get<CaseSummary[]>("/api/cases", { params })).data;
    },
  });

  // Client-side search + sort + paginate
  const filtered = allCases
    .filter((c) =>
      !search ||
      c.external_ref?.toLowerCase().includes(search.toLowerCase()) ||
      c.id.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => {
      let av: number | string = 0, bv: number | string = 0;
      if (sortKey === "amount")      { av = a.amount ?? 0; bv = b.amount ?? 0; }
      if (sortKey === "fraud_score") { av = a.fraud_score ?? 0; bv = b.fraud_score ?? 0; }
      if (sortKey === "submitted_at"){ av = a.submitted_at ?? ""; bv = b.submitted_at ?? ""; }
      if (av < bv) return sortDir === "asc" ? -1 :  1;
      if (av > bv) return sortDir === "asc" ?  1 : -1;
      return 0;
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="ml-1 opacity-30">↕</span>;
    return <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Cases</h1>
        <span className="text-sm text-muted-foreground">{filtered.length} total</span>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input
            className="h-8 rounded-lg border border-input bg-background pl-8 pr-3 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Search ref or ID…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={lob}
          onChange={(e) => { setLob(e.target.value); setPage(1); }}
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {LOB_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {(status || lob || search) && (
          <Button
            variant="ghost" size="sm"
            onClick={() => { setStatus(""); setLob(""); setSearch(""); setPage(1); }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-8" />
                <TableHead>Reference</TableHead>
                <TableHead>Line of Business</TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("amount")}
                >
                  Amount <SortIcon col="amount" />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("fraud_score")}
                >
                  Risk <SortIcon col="fraud_score" />
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead
                  className="cursor-pointer select-none hidden md:table-cell"
                  onClick={() => toggleSort("submitted_at")}
                >
                  Submitted <SortIcon col="submitted_at" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <EmptyState variant="filter" />
                  </TableCell>
                </TableRow>
              )}
              {paged.map((c) => {
                const isExpanded = expandedId === c.id;
                return (
                  <>
                    <TableRow
                      key={c.id}
                      className="cursor-pointer group"
                      onClick={() => setExpandedId(isExpanded ? null : c.id)}
                    >
                      <TableCell className="pr-0">
                        {isExpanded
                          ? <ChevronDownIcon className="size-3.5 text-muted-foreground" />
                          : <ChevronRightIcon className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                        }
                      </TableCell>
                      <TableCell className="font-medium">
                        <Link
                          href={`/cases/${c.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-primary hover:underline"
                        >
                          {c.external_ref ?? c.id.slice(0, 8)}
                        </Link>
                      </TableCell>
                      <TableCell className="capitalize text-sm text-muted-foreground">
                        {c.line_of_business?.replace(/_/g, " ") ?? "—"}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {fmtKES(c.amount)}
                      </TableCell>
                      <TableCell>
                        <RiskBadge band={c.fraud_band} score={c.fraud_score} />
                      </TableCell>
                      <TableCell>
                        <CaseStatusBadge status={c.status} />
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {c.submitted_at
                          ? new Date(c.submitted_at).toLocaleDateString()
                          : "—"}
                      </TableCell>
                    </TableRow>

                    {/* Expanded row */}
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <tr key={`${c.id}-exp`}>
                          <td colSpan={7} className="p-0">
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.18, ease: "easeInOut" }}
                              className="overflow-hidden"
                            >
                              <div className="flex items-center gap-6 bg-muted/30 border-b border-border px-6 py-3 text-sm">
                                <span className="text-muted-foreground">
                                  <span className="font-medium text-foreground">Case type:</span>{" "}
                                  {c.case_type ?? "—"}
                                </span>
                                <span className="text-muted-foreground">
                                  <span className="font-medium text-foreground">ID:</span>{" "}
                                  <span className="font-mono text-xs">{c.id}</span>
                                </span>
                                <Link
                                  href={`/cases/${c.id}`}
                                  className="ml-auto text-primary text-sm hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Open full case →
                                </Link>
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </AnimatePresence>
                  </>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page} of {totalPages} · {filtered.length} cases
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              ← Prev
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
