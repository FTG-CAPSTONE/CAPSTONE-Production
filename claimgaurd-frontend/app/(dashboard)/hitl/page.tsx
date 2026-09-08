"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import type { ReviewQueueItem } from "@/lib/types";

export default function HitlPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["hitl-queue"],
    queryFn: async () => (await apiClient.get<ReviewQueueItem[]>("/api/hitl/queue")).data,
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Review Queue</h1>
      <p className="mb-4 text-sm text-slate-500">
        Sorted by priority score — combines fraud probability, rule flags, and model confidence.
      </p>
      <div className="rounded-xl border border-slate-200 bg-white">
        {isLoading ? (
          <p className="p-6 text-sm text-slate-500">Loading...</p>
        ) : !data?.length ? (
          <p className="p-6 text-sm text-slate-500">Queue is empty — nothing needs human review right now.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.map((item) => (
              <li key={item.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Case {item.case_id.slice(0, 8)}</p>
                  <p className="text-xs text-slate-500">{item.reason?.replace(/_/g, " ") ?? "—"}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-semibold">
                    {item.priority_score != null ? Number(item.priority_score).toFixed(1) : "—"}
                  </span>
                  <Link href={`/cases/${item.case_id}`} className="text-sm text-blue-700 hover:underline">
                    Review →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
