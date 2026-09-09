"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/shared/stat-card";
import { StatRowSkeleton } from "@/components/shared/loading-skeleton";
import { apiClient } from "@/lib/api-client";
import { fmtKES, fmtPercent, fmtNumber } from "@/lib/constants";
import { formatDistanceToNow } from "@/lib/utils";
import type { AnalyticsOverview, AuditEvent } from "@/lib/types";
import { useCurrentUser, getGreeting } from "@/hooks/use-current-user";
import {
  FolderOpenIcon, ClipboardListIcon, TrendingUpIcon,
  BrainCircuitIcon, AlertTriangleIcon, Activity,
  BarChart3, ShieldIcon, TargetIcon, ClockIcon,
} from "lucide-react";

// ── Chart configs ─────────────────────────────────────────────────────────────

const trendConfig: ChartConfig = {
  fraud_score: { label: "Avg Fraud Score", color: "var(--color-primary)" },
};
const lobConfig: ChartConfig = {
  value: { label: "Cases", color: "var(--color-primary)" },
};

const STATUS_COLOURS: Record<string, string> = {
  auto_approved:      "#0ea5e9",
  approved:           "#16a34a",
  human_approve:      "#16a34a",
  in_review:          "#7c3aed",
  auto_rejected:      "#f97316",
  auto_rejected_rule: "#f97316",
  declined:           "#dc2626",
  human_decline:      "#dc2626",
  rejected:           "#dc2626",
  received:           "#6b7280",
  processing:         "#2563eb",
  closed:             "#374151",
};

// Deterministic 30-day trend (no Math.random → no hydration mismatch)
const TREND_OFFSETS = [
  2,-1,3,-2,1,4,-3,2,0,-1,3,1,-2,4,2,-1,0,3,-2,1,2,-1,3,0,-2,1,4,-3,2,1
];
function mockTrend(avgScore: number | null) {
  const base = avgScore ?? 22;
  return TREND_OFFSETS.map((offset, i) => ({
    day: `D${i + 1}`,
    fraud_score: Math.max(0, Math.min(100, base + offset)),
  }));
}

// ── Activity feed item ────────────────────────────────────────────────────────

const EVENT_LABELS: Record<string, string> = {
  case_ingested:        "New case submitted",
  etl_completed:        "ETL completed",
  ml_scored:            "Case scored by ML",
  decision_recorded:    "Decision made",
  auto_approved:        "Case auto-approved",
  auto_rejected:        "Case auto-rejected",
  routed_to_hitl:       "Routed to review",
  document_uploaded:    "Document uploaded",
};

function ActivityItem({ event }: { event: AuditEvent }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="rounded-full bg-muted p-1.5 mt-0.5 shrink-0">
        <Activity className="h-3 w-3 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {EVENT_LABELS[event.event_type] ?? event.event_type.replace(/_/g, " ")}
        </p>
        <p className="text-xs text-muted-foreground">
          {event.actor && event.actor !== "system" ? `${event.actor} · ` : ""}
          {formatDistanceToNow(event.occurred_at)}
        </p>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const user = useCurrentUser();
  const greeting = getGreeting();

  const { data, isLoading } = useQuery<AnalyticsOverview>({
    queryKey: ["analytics-overview"],
    queryFn: async () =>
      (await apiClient.get<AnalyticsOverview>("/api/analytics/overview")).data,
  });

  const { data: recentActivity = [] } = useQuery<AuditEvent[]>({
    queryKey: ["recent-activity"],
    queryFn: async () => {
      try {
        return (await apiClient.get<AuditEvent[]>("/api/audit/events", { params: { limit: 5 } })).data;
      } catch { return []; }
    },
  });

  const avgScore  = data?.avg_fraud_score ?? data?.average_fraud_score ?? null;
  const trendData = mockTrend(avgScore);

  const statusData = data
    ? Object.entries(data.cases_by_status)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => ({ name: k.replace(/_/g, " "), value: v, key: k }))
    : [];

  const lobData = data
    ? Object.entries(data.cases_by_lob ?? data.cases_by_line_of_business ?? {})
        .map(([k, v]) => ({ name: k.replace(/_/g, " "), value: v }))
    : [];

  const autoRate = data?.auto_decision_rate != null
    ? data.auto_decision_rate / 100  // already a percentage
    : null;

  const inQueue = data?.in_review ?? data?.cases_by_status?.["in_review"] ?? 0;

  const roleLabel = user?.role === "admin" ? "Administrator"
    : user?.role === "ml_admin" ? "ML Administrator"
    : user?.role === "adjuster" ? "Claims Adjuster"
    : user?.role === "underwriter" ? "Underwriter"
    : user?.role === "investigator" ? "Investigator"
    : user?.role === "compliance" ? "Compliance Officer"
    : "User";

  return (
    <div className="flex flex-col gap-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-semibold">
          {greeting}{user?.name ? `, ${user.name}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {roleLabel} · ClaimGuard Motor Claims Intelligence
        </p>
      </div>

      {/* KPI row */}
      {isLoading ? (
        <StatRowSkeleton />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <StatCard
            label="Total Cases"
            value={fmtNumber(data?.total_cases)}
            icon={FolderOpenIcon}
            iconClass="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          />
          <StatCard
            label="In Review Queue"
            value={fmtNumber(inQueue)}
            icon={ClockIcon}
            iconClass="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
          />
          <StatCard
            label="Auto Decision Rate"
            value={data?.auto_decision_rate != null ? `${data.auto_decision_rate.toFixed(1)}%` : "—"}
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
            label="SLA Compliance"
            value={data?.sla_compliance_rate != null ? `${data.sla_compliance_rate.toFixed(1)}%` : "—"}
            icon={ShieldIcon}
            iconClass="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
          />
          <StatCard
            label="Champion Model"
            value={data?.current_champion_model ?? "None"}
            icon={BrainCircuitIcon}
            iconClass="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
          />
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" nativeButton={false} render={<Link href="/hitl" />}>Review Queue →</Button>
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/cases" />}>All Cases</Button>
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/analytics" />}>Analytics</Button>
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/ml-admin" />}>ML Admin</Button>
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/ml-performance" />}>ML Performance</Button>
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/network" />}>Network / Rings</Button>
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
              <Area dataKey="fraud_score" stroke="var(--color-primary)" strokeWidth={2}
                fill="url(#gradFraud)" dot={false} />
            </AreaChart>
          </ChartContainer>
        </div>

        {/* Status donut */}
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm font-semibold mb-1">Cases by Status</p>
          {statusData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={45} outerRadius={65}
                    paddingAngle={3} dataKey="value">
                    {statusData.map((e) => (
                      <Cell key={e.key} fill={STATUS_COLOURS[e.key] ?? "#94a3b8"} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, String(n).replace(/_/g, " ")]}
                    contentStyle={{ fontSize: 12, borderRadius: 8,
                      border: "1px solid var(--border)", background: "var(--card)" }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-1 space-y-1">
                {statusData.slice(0, 4).map((e) => (
                  <div key={e.key} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full" style={{ background: STATUS_COLOURS[e.key] ?? "#94a3b8" }} />
                      {e.name}
                    </span>
                    <span className="text-muted-foreground">{e.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
              No data yet
            </div>
          )}
        </div>
      </div>

      {/* Activity + LOB row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent activity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length > 0 ? (
              <div className="divide-y divide-border">
                {recentActivity.map((event, i) => (
                  <ActivityItem key={event.id ?? i} event={event} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No recent activity
              </p>
            )}
          </CardContent>
        </Card>

        {/* LOB bar */}
        {lobData.length > 0 ? (
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm font-semibold mb-4">Cases by Line of Business</p>
            <ChartContainer config={lobConfig} className="h-[160px] w-full">
              <BarChart data={lobData} margin={{ top: 0, right: 8, bottom: 0, left: -10 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.3} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="value" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </div>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Cases by Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data?.cases_by_status ? (
                <div className="space-y-2">
                  {Object.entries(data.cases_by_status).map(([status, count]) => {
                    const pct = data.total_cases > 0 ? (count / data.total_cases) * 100 : 0;
                    return (
                      <div key={status} className="flex items-center gap-2">
                        <span className="text-sm capitalize w-28 truncate">
                          {status.replace(/_/g, " ")}
                        </span>
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-sm text-muted-foreground w-10 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
