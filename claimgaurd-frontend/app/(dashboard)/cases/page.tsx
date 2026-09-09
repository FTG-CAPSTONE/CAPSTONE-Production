"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { CaseTable, type SortField, type SortOrder } from "@/components/case-table";
import type { CaseSummary, CaseStatus } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";

const STATUS_OPTIONS: { value: CaseStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "in_review", label: "In Review" },
  { value: "auto_approved", label: "Auto Approved" },
  { value: "auto_rejected", label: "Auto Rejected" },
  { value: "approved", label: "Approved" },
  { value: "declined", label: "Declined" },
  { value: "received", label: "Received" },
  { value: "processing", label: "Processing" },
  { value: "closed", label: "Closed" },
];

const LOB_OPTIONS = [
  { value: "", label: "All LOB" },
  { value: "motor", label: "Motor" },
  { value: "health", label: "Health" },
  { value: "property", label: "Property" },
  { value: "life", label: "Life" },
  { value: "liability", label: "Liability" },
];

const PAGE_SIZE = 20;

export default function CasesPage() {
  // Filter state
  const [status, setStatus] = useState<CaseStatus | "">("");
  const [lob, setLob] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Pagination state
  const [page, setPage] = useState(1);

  // Sort state
  const [sortField, setSortField] = useState<SortField>("submitted_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["cases", status, lob, page],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        page,
        limit: PAGE_SIZE,
      };
      if (status) params.status = status;
      if (lob) params.line_of_business = lob;
      
      const res = await apiClient.get<CaseSummary[]>("/api/cases", { params });
      return res.data;
    },
  });

  // Client-side filtering for search and date range
  const filteredCases = useMemo(() => {
    if (!data) return [];
    
    let result = [...data];

    // Search filter
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.external_claim_id?.toLowerCase().includes(searchLower) ||
          c.id.toLowerCase().includes(searchLower) ||
          c.claim_type?.toLowerCase().includes(searchLower)
      );
    }

    // Date range filter
    if (dateFrom) {
      const from = new Date(dateFrom);
      result = result.filter((c) => new Date(c.submitted_at) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter((c) => new Date(c.submitted_at) <= to);
    }

    // Sorting
    result.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case "external_claim_id":
          comparison = (a.external_claim_id ?? "").localeCompare(b.external_claim_id ?? "");
          break;
        case "amount_claimed":
          comparison = parseFloat(a.amount_claimed ?? "0") - parseFloat(b.amount_claimed ?? "0");
          break;
        case "fraud_score":
          comparison = parseFloat(a.fraud_score ?? "0") - parseFloat(b.fraud_score ?? "0");
          break;
        case "submitted_at":
          comparison = new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime();
          break;
        case "status":
          comparison = a.status.localeCompare(b.status);
          break;
      }
      
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [data, search, dateFrom, dateTo, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const clearFilters = () => {
    setStatus("");
    setLob("");
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const hasFilters = status || lob || search || dateFrom || dateTo;
  const emptyVariant = hasFilters ? "filter" : "no-data";
  const hasMore = data && data.length === PAGE_SIZE;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Cases</h1>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            Clear filters
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by claim ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>

            {/* Status Filter */}
            <Select 
              value={status || "all"} 
              onValueChange={(v: string | null) => { 
                setStatus(v === "all" || v === null ? "" : v as CaseStatus); 
                setPage(1); 
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value || "all"} value={opt.value || "all"}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* LOB Filter */}
            <Select 
              value={lob || "all"} 
              onValueChange={(v: string | null) => { 
                setLob(v === "all" || v === null ? "" : v); 
                setPage(1); 
              }}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="All LOB" />
              </SelectTrigger>
              <SelectContent>
                {LOB_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value || "all"} value={opt.value || "all"}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date From */}
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-[140px]"
              placeholder="From date"
            />

            {/* Date To */}
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-[140px]"
              placeholder="To date"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : (
            <CaseTable
              cases={filteredCases}
              sortField={sortField}
              sortOrder={sortOrder}
              onSort={handleSort}
              emptyVariant={emptyVariant}
            />
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {!isLoading && filteredCases.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {filteredCases.length} case{filteredCases.length !== 1 ? "s" : ""}
            {hasFilters && " (filtered)"}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || isFetching}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              Page {page}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasMore || isFetching}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
