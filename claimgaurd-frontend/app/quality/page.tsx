"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export default function QualityPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["quality-summary"],
    queryFn: async () => (await apiClient.get<Record<string, number>>("/api/quality/summary")).data,
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Data Quality</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {isLoading || !data ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : (
          Object.entries(data).map(([decision, count]) => (
            <div key={decision} className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs uppercase tracking-wide text-slate-500">{decision}</p>
              <p className="mt-1 text-2xl font-semibold">{count}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
