"use client";

import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiClient } from "@/lib/api-client";
import type { AnalyticsOverview } from "@/lib/types";

export default function AnalyticsPage() {
  const { data } = useQuery({
    queryKey: ["analytics-overview"],
    queryFn: async () => (await apiClient.get<AnalyticsOverview>("/api/analytics/overview")).data,
  });

  const byLine = Object.entries(data?.cases_by_line_of_business ?? {}).map(([name, value]) => ({ name, value }));
  const byStatus = Object.entries(data?.cases_by_status ?? {}).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Analytics</h1>

      <section>
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-slate-500">Cases by Line of Business</h2>
        <div className="h-64 rounded-xl border border-slate-200 bg-white p-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byLine}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-slate-500">Cases by Status</h2>
        <div className="h-64 rounded-xl border border-slate-200 bg-white p-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byStatus}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#0f766e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
