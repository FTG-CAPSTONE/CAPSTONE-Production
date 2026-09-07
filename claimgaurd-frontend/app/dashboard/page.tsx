"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { AnalyticsOverview } from "@/lib/types";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics-overview"],
    queryFn: async () => (await apiClient.get<AnalyticsOverview>("/api/analytics/overview")).data,
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Portfolio Overview</h1>
      {isLoading || !data ? (
        <p className="text-sm text-slate-500">Loading...</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Total cases" value={data.total_cases} />
          <StatCard label="In review" value={data.cases_by_status["in_review"] ?? 0} />
          <StatCard label="Auto-approved" value={data.cases_by_status["auto_approved"] ?? 0} />
          <StatCard
            label="Avg. fraud score"
            value={data.average_fraud_score !== null ? data.average_fraud_score.toFixed(1) : "—"}
          />
          <StatCard label="Champion model" value={data.current_champion_model ?? "None registered"} />
        </div>
      )}
    </div>
  );
}
