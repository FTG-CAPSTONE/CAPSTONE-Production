"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { apiClient } from "@/lib/api-client";
import { CaseTable } from "@/components/case-table";
import type { CaseSummary } from "@/lib/types";

const STATUS_FILTERS = ["", "in_review", "auto_approved", "human_decline", "rejected"];

export default function CasesPage() {
  const [status, setStatus] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["cases", status],
    queryFn: async () =>
      (await apiClient.get<CaseSummary[]>("/api/cases", { params: status ? { status } : {} })).data,
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Cases</h1>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {s === "" ? "All statuses" : s}
            </option>
          ))}
        </select>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        {isLoading ? <p className="text-sm text-slate-500">Loading...</p> : <CaseTable cases={data ?? []} />}
      </div>
    </div>
  );
}
