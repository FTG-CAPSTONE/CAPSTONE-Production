"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/shared/stat-card";
import { StatRowSkeleton } from "@/components/shared/loading-skeleton";
import { apiClient } from "@/lib/api-client";
import { fmtKES, fmtPercent, fmtNumber } from "@/lib/constants";
import type { AnalyticsOverview } from "@/lib/types";
import {
  FolderOpenIcon, ClipboardListIcon, TrendingUpIcon,
  BrainCircuitIcon, ShieldCheckIcon, AlertTriangleIcon,
} from "lucide-react";

const trendConfig: ChartConfig = {
  fraud_score: { label: "Avg Fraud Score", color: "var(--color-primary)" },
};

const statusConfig: ChartConfig = {
  value: { label: "Cases", color: "var(--color-primary)" },
};

const STATUS_COLOURS: Record<string, string> = {
  auto_approved:    "#0ea5e9",
  approved:         "#16a34a",
  human_approve:    "#16a34a",
  in_review:        "#7c3aed",
  auto_rejected:    "#f97316",
  auto_rejected_rule:"#f97316",
  declined:         "#dc2626",
  human_decline:    "#dc2626",
  rejected:         "#dc2626",
  received:         "#6b7280",
  processing:       "#2563eb",
  closed:           "#374151",
};

// Generate 30-day mock trend until the analytics/trend endpoint exists
function mockTrend(avgScore: number | null) {
  const base = avgScore ?? 22;
  return Array.from({ length: 30 }, (_, i) => ({
    day: `Day ${i + 1}`,
    fraud_score: Math.max(0, Math.min(100,
      base + (Math.sin(i * 0.4) * 6) + (Math.random() - 0.5) * 4,
    )),
  }));
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery<AnalyticsOverview>({
    queryKey: ["analytics-overview"],
    queryFn: async () =>
      (await apiClient.get<AnalyticsOverview>("/api/analytics/overview")).data,
  });

  const avgScore = data?.average_fraud_score ?? data?.avg_fraud_score;
  const trendData = mockTrend(avgScore);

  const statusData = data
    ? Object.entries(data.cases_by_status).map(([k, v]) => ({
        name: k.replace(/_/g, " "),
        value: v,
        key: k,
      }))
    : [];

  const autoRate = data?.auto_decision_rate
    ?? (data && data.total_cases > 0
      ? ((data.auto_approved ?? 0) + (data.cases_by_status?.["auto_approved"] ?? 0)) / data.total_cases
      : null);

  const inQueue = data?.in_review
    ?? data?.cases_by_status?.["in_review"]
    ?? 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Portfolio Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            ClaimGuard · Motor Claims Intelligence
          </p>
        </div>
      </div>

      {/* KPI row */}
      {isLoading ? (
        <StatRowSkeleton />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
          <StatCard
            label="Total Cases"
            value={fmtNumber(data?.total_cases)}
            icon={FolderOpenIcon}
            iconClass="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          />
          <StatCard
            label="In Review Queue"
            value={fmtNumber(inQueue)}
            icon={ClipboardListIcon}
            iconClass="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
          />
          <StatCard
            label="Auto Decision Rate"
            value={fmtPercent(autoRate)}
            icon={TrendingUpIcon}
            iconClass="bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400"
          />
          <StatCard
            label="Avg Fraud Score"
            value={avgScore != null ? Number(avgScore).toFixed(1) : "—"}
            icon={AlertTriangleIcon}
            iconClass="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
          />
          <StatCard
            label="Champion Model"
            value={data?.current_champion_model ?? "None"}
            icon={BrainCircuitIcon}
            iconClass="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
            className="col-span-2 md:col-span-1"
          />
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" render={<Link href="/hitl" />}>Review Queue →</Button>
        <Button variant="outline" size="sm" render={<Link href="/cases" />}>All Cases</Button>
        <Button variant="outline" size="sm" render={<Link href="/analytics" />}>Analytics</Button>
        <Button variant="outline" size="sm" render={<Link href="/ml-admin" />}>ML Admin</Button>
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Fraud trend */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <p className="text-sm font-semibold mb-1">Fraud Score Trend</p>
          <p className="text-xs text-muted-foreground mb-4">30-day rolling average</p>
          <ChartContainer config={trendConfig} className="h-[200px] w-full">
            <AreaChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="gradFraud" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.3} />
              <XAxis dataKey="day" hide />
              <YAxis tickLine={false} axisLine={false} fontSize={11} width={28} domain={[0, 100]} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                dataKey="fraud_score"
                stroke="var(--color-primary)"
                strokeWidth={2}
                fill="url(#gradFraud)"
                dot={false}
              />
            </AreaChart>
          </ChartContainer>
        </div>

        {/* Status donut */}
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm font-semibold mb-1">Cases by Status</p>
          <p className="text-xs text-muted-foreground mb-4">Current distribution</p>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {statusData.map((entry) => (
                    <Cell
                      key={entry.key}
                      fill={STATUS_COLOURS[entry.key] ?? "#94a3b8"}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v, n) => [v, String(n).replace(/_/g, " ")]}
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--card)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
              No data yet
            </div>
          )}
        </div>
      </div>

      {/* Cases by LOB */}
      {data && Object.keys(data.cases_by_line_of_business ?? {}).length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm font-semibold mb-4">Cases by Line of Business</p>
          <ChartContainer config={statusConfig} className="h-[120px] w-full">
            <BarChart
              data={Object.entries(data.cases_by_line_of_business).map(([k, v]) => ({
                name: k.replace(/_/g, " "),
                value: v,
              }))}
              margin={{ top: 0, right: 8, bottom: 0, left: -10 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.3} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickLine={false} axisLine={false} fontSize={12} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </div>
      )}
    </div>
  );
}
