"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { CaseTable } from "@/components/case-table";
import type { CaseSummary } from "@/lib/types";

// Real backend enum values from CaseStatus
const STATUS_FILTERS = [
  { value: "",              label: "All statuses" },
  { value: "in_review",     label: "In Review" },
  { value: "auto_approved", label: "Auto Approved" },
  { value: "auto_rejected", label: "Auto Rejected" },
  { value: "approved",      label: "Approved" },
  { value: "declined",      label: "Declined" },
  { value: "received",      label: "Received" },
  { value: "processing",    label: "Processing" },
  { value: "closed",        label: "Closed" },
];

export default function CasesPage() {
  const [status, setStatus] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["cases", status],
    queryFn: async () =>
      (
        await apiClient.get<CaseSummary[]>("/api/cases", {
          params: status ? { status } : {},
        })
      ).data,
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Cases</h1>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <CaseTable cases={data ?? []} />
        )}
      </div>
    </div>
  );
}
