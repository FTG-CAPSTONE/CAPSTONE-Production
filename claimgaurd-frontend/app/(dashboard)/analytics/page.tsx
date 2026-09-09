"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { StatCard } from "@/components/shared/stat-card";
import { StatRowSkeleton, TableSkeleton } from "@/components/shared/loading-skeleton";
import { apiClient } from "@/lib/api-client";
import { fmtKES, fmtNumber, fmtPercent } from "@/lib/constants";
import type { AnalyticsOverview } from "@/lib/types";
import {
  FolderOpenIcon, TrendingUpIcon, AlertTriangleIcon,
  ShieldCheckIcon, CoinsIcon,
} from "lucide-react";

const trendConfig: ChartConfig = {
  fraud_score: { label: "Avg Fraud Score", color: "var(--color-primary)" },
};
const lobConfig: ChartConfig = {
  value: { label: "Cases", color: "#1e3a5f" },
};
const slaConfig: ChartConfig = {
  compliance: { label: "SLA Compliance %", color: "#16a34a" },
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

function mockTrend(avg: number | null) {
  const base = avg ?? 22;
  return Array.from({ length: 30 }, (_, i) => ({
    day: `D${i + 1}`,
    fraud_score: Math.max(0, Math.min(100,
      base + Math.sin(i * 0.45) * 7 + (Math.random() - 0.5) * 5,
    )),
  }));
}

function mockSLA() {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"];
  return months.map((m) => ({
    month: m,
    compliance: 80 + Math.random() * 18,
  }));
}

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery<AnalyticsOverview>({
    queryKey: ["analytics-overview"],
    queryFn: async () =>
      (await apiClient.get<AnalyticsOverview>("/api/analytics/overview")).data,
  });

  const avgScore = data?.average_fraud_score ?? data?.avg_fraud_score ?? null;
  const trendData = mockTrend(avgScore);
  const slaData   = mockSLA();

  const autoRate = data?.auto_decision_rate
    ?? (data && data.total_cases > 0
      ? ((data.cases_by_status?.["auto_approved"] ?? 0) +
         (data.cases_by_status?.["auto_rejected"] ?? 0)) / data.total_cases
      : null);

  const fraudRate = data && data.total_cases > 0
    ? ((data.cases_by_status?.["declined"] ?? 0) +
       (data.cases_by_status?.["human_decline"] ?? 0) +
       (data.cases_by_status?.["rejected"] ?? 0)) / data.total_cases
    : null;

  const statusData = data
    ? Object.entries(data.cases_by_status)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => ({ name: k.replace(/_/g, " "), value: v, key: k }))
    : [];

  const lobData = data
    ? Object.entries(data.cases_by_line_of_business)
        .map(([k, v]) => ({ name: k.replace(/_/g, " "), value: v }))
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <span className="text-xs text-muted-foreground">Motor Claims Portfolio · MVP</span>
      </div>

      {/* KPI row */}
      {isLoading ? (
        <StatRowSkeleton />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <StatCard
            label="Total Cases"
            value={fmtNumber(data?.total_cases)}
            icon={FolderOpenIcon}
            iconClass="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          />
          <StatCard
            label="Auto Decision Rate"
            value={fmtPercent(autoRate)}
            icon={TrendingUpIcon}
            iconClass="bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400"
          />
          <StatCard
            label="Fraud Rate"
            value={fmtPercent(fraudRate)}
            icon={AlertTriangleIcon}
            iconClass="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
          />
          <StatCard
            label="SLA Compliance"
            value={data?.sla_compliance_rate != null
              ? fmtPercent(data.sla_compliance_rate)
              : "—"}
            icon={ShieldCheckIcon}
            iconClass="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
          />
          <StatCard
            label="Est. Fraud Savings"
            value={data?.estimated_fraud_savings_kes != null
              ? fmtKES(data.estimated_fraud_savings_kes)
              : "—"}
            icon={CoinsIcon}
            iconClass="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
            className="col-span-2 md:col-span-1"
          />
        </div>
      )}

      {/* Row: Fraud trend + Status donut */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <p className="text-sm font-semibold mb-0.5">Fraud Score Trend</p>
          <p className="text-xs text-muted-foreground mb-4">30-day rolling average</p>
          <ChartContainer config={trendConfig} className="h-[220px] w-full">
            <AreaChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.3} />
              <XAxis dataKey="day" hide />
              <YAxis tickLine={false} axisLine={false} fontSize={11} width={28} domain={[0, 100]} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area dataKey="fraud_score" stroke="var(--color-primary)" strokeWidth={2}
                fill="url(#aGrad)" dot={false} />
            </AreaChart>
          </ChartContainer>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm font-semibold mb-0.5">Case Status</p>
          <p className="text-xs text-muted-foreground mb-2">Distribution</p>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="45%" innerRadius={52} outerRadius={72}
                  paddingAngle={3} dataKey="value">
                  {statusData.map((e) => (
                    <Cell key={e.key} fill={STATUS_COLOURS[e.key] ?? "#94a3b8"} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v, n) => [v, String(n).replace(/_/g, " ")]}
                  contentStyle={{ fontSize: 12, borderRadius: 8,
                    border: "1px solid var(--border)", background: "var(--card)" }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
              No data yet
            </div>
          )}
          {/* Legend */}
          <div className="mt-2 space-y-1">
            {statusData.slice(0, 5).map((e) => (
              <div key={e.key} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ background: STATUS_COLOURS[e.key] ?? "#94a3b8" }} />
                  {e.name}
                </span>
                <span className="text-muted-foreground">{e.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* LOB bar + SLA bar */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm font-semibold mb-4">Cases by Line of Business</p>
          {lobData.length > 0 ? (
            <ChartContainer config={lobConfig} className="h-[160px] w-full">
              <BarChart data={lobData} margin={{ top: 0, right: 8, bottom: 0, left: -10 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.3} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="value" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          ) : (
            <div className="flex h-[160px] items-center justify-center text-sm text-muted-foreground">
              No data yet
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm font-semibold mb-0.5">SLA Compliance by Month</p>
          <p className="text-xs text-muted-foreground mb-4">90-day statutory target</p>
          <ChartContainer config={slaConfig} className="h-[160px] w-full">
            <BarChart data={slaData} margin={{ top: 0, right: 8, bottom: 0, left: -10 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.3} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickLine={false} axisLine={false} fontSize={12} domain={[0, 100]}
                tickFormatter={(v) => `${v}%`} />
              <ChartTooltip
                content={<ChartTooltipContent formatter={(v) => [`${Number(v).toFixed(1)}%`, "Compliance"]} />}
              />
              <Bar dataKey="compliance" fill="#16a34a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </div>
      </div>
    </div>
  );
}
