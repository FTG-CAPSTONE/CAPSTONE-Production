"use client";

import Link from "next/link";
import type { CaseSummary, CaseStatus, FraudBand } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";
import { RiskBadge } from "@/components/risk-badge";
import { EmptyState } from "@/components/empty-state";
import { formatCurrency } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, ArrowUp, ArrowDown, ExternalLink } from "lucide-react";

export type SortField = "external_claim_id" | "amount_claimed" | "fraud_score" | "submitted_at" | "status";
export type SortOrder = "asc" | "desc";

interface CaseTableProps {
  cases: CaseSummary[];
  sortField?: SortField;
  sortOrder?: SortOrder;
  onSort?: (field: SortField) => void;
  emptyVariant?: "no-data" | "search" | "filter";
}

function SortableHeader({
  children,
  field,
  currentField,
  currentOrder,
  onSort,
}: {
  children: React.ReactNode;
  field: SortField;
  currentField?: SortField;
  currentOrder?: SortOrder;
  onSort?: (field: SortField) => void;
}) {
  const isActive = currentField === field;
  
  const SortIcon = !isActive
    ? ArrowUpDown
    : currentOrder === "asc"
      ? ArrowUp
      : ArrowDown;

  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 data-[state=open]:bg-accent"
      onClick={() => onSort?.(field)}
    >
      {children}
      <SortIcon className="ml-2 h-4 w-4" />
    </Button>
  );
}

export function CaseTable({
  cases,
  sortField,
  sortOrder,
  onSort,
  emptyVariant = "no-data",
}: CaseTableProps) {
  if (!cases.length) {
    return (
      <EmptyState
        variant={emptyVariant}
        title={emptyVariant === "filter" ? "No cases match your filters" : "No cases found"}
        description={
          emptyVariant === "filter"
            ? "Try adjusting your filters or search terms."
            : "Cases will appear here once submitted."
        }
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>
            {onSort ? (
              <SortableHeader
                field="external_claim_id"
                currentField={sortField}
                currentOrder={sortOrder}
                onSort={onSort}
              >
                Reference
              </SortableHeader>
            ) : (
              "Reference"
            )}
          </TableHead>
          <TableHead>Type</TableHead>
          <TableHead>LOB</TableHead>
          <TableHead className="text-right">
            {onSort ? (
              <SortableHeader
                field="amount_claimed"
                currentField={sortField}
                currentOrder={sortOrder}
                onSort={onSort}
              >
                Amount
              </SortableHeader>
            ) : (
              "Amount"
            )}
          </TableHead>
          <TableHead>
            {onSort ? (
              <SortableHeader
                field="fraud_score"
                currentField={sortField}
                currentOrder={sortOrder}
                onSort={onSort}
              >
                Risk
              </SortableHeader>
            ) : (
              "Risk"
            )}
          </TableHead>
          <TableHead>
            {onSort ? (
              <SortableHeader
                field="status"
                currentField={sortField}
                currentOrder={sortOrder}
                onSort={onSort}
              >
                Status
              </SortableHeader>
            ) : (
              "Status"
            )}
          </TableHead>
          <TableHead>
            {onSort ? (
              <SortableHeader
                field="submitted_at"
                currentField={sortField}
                currentOrder={sortOrder}
                onSort={onSort}
              >
                Submitted
              </SortableHeader>
            ) : (
              "Submitted"
            )}
          </TableHead>
          <TableHead className="w-[50px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {cases.map((c) => (
          <TableRow key={c.id}>
            <TableCell className="font-mono text-xs">
              {c.external_claim_id
                ? c.external_claim_id.slice(-12)
                : c.id.slice(0, 8)}
            </TableCell>
            <TableCell className="capitalize">
              {c.claim_type?.replace(/_/g, " ") ?? "—"}
            </TableCell>
            <TableCell className="capitalize">
              {c.line_of_business.replace(/_/g, " ")}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatCurrency(c.amount_claimed)}
            </TableCell>
            <TableCell>
              <RiskBadge band={c.fraud_band} score={c.fraud_score} showScore />
            </TableCell>
            <TableCell>
              <StatusBadge status={c.status} />
            </TableCell>
            <TableCell className="text-muted-foreground text-xs">
              {new Date(c.submitted_at).toLocaleDateString()}
            </TableCell>
            <TableCell>
              <Link href={`/cases/${c.id}`}>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <ExternalLink className="h-4 w-4" />
                  <span className="sr-only">View case</span>
                </Button>
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
