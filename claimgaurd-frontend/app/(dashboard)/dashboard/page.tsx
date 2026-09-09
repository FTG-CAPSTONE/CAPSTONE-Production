"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { AnalyticsOverview, AuditEvent } from "@/lib/types";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentUser, getGreeting } from "@/hooks/use-current-user";
import {
  FileCheck,
  AlertTriangle,
  BarChart3,
  Settings,
  Activity,
  TrendingUp,
  Shield,
  Clock,
  Brain,
  Target,
} from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "@/lib/utils";

const quickActions = [
  {
    title: "Review Queue",
    description: "Cases awaiting human review",
    href: "/hitl",
    icon: AlertTriangle,
    color: "text-amber-600",
    bgColor: "bg-amber-50 dark:bg-amber-900/20",
  },
  {
    title: "All Cases",
    description: "Browse and manage cases",
    href: "/cases",
    icon: FileCheck,
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-900/20",
  },
  {
    title: "Analytics",
    description: "View performance metrics",
    href: "/analytics",
    icon: BarChart3,
    color: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-900/20",
  },
  {
    title: "ML Admin",
    description: "Model registry & training",
    href: "/ml-admin",
    icon: Settings,
    color: "text-purple-600",
    bgColor: "bg-purple-50 dark:bg-purple-900/20",
  },
];

function QuickActionCard({
  title,
  description,
  href,
  icon: Icon,
  color,
  bgColor,
}: (typeof quickActions)[0]) {
  return (
    <Link href={href}>
      <Card className="transition-shadow hover:shadow-md cursor-pointer h-full">
        <CardContent className="pt-4">
          <div className={`inline-flex rounded-lg p-2 ${bgColor}`}>
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
          <h3 className="mt-3 font-medium">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

function RecentActivityItem({ event }: { event: AuditEvent }) {
  const eventTypeLabels: Record<string, string> = {
    case_created: "New case submitted",
    case_scored: "Case scored by ML",
    case_approved: "Case approved",
    case_declined: "Case declined",
    case_reviewed: "Case reviewed",
    decision_made: "Decision made",
  };

  return (
    <div className="flex items-start gap-3 py-2">
      <div className="rounded-full bg-muted p-1.5">
        <Activity className="h-3 w-3 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {eventTypeLabels[event.event_type] || event.event_type}
        </p>
        <p className="text-xs text-muted-foreground">
          {event.actor && `by ${event.actor} · `}
          {formatDistanceToNow(event.occurred_at)}
        </p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const user = useCurrentUser();
  const greeting = getGreeting();

  const { data, isLoading } = useQuery({
    queryKey: ["analytics-overview"],
    queryFn: async () =>
      (await apiClient.get<AnalyticsOverview>("/api/analytics/overview")).data,
  });

  // Fetch recent activity for activity feed
  const { data: recentActivity } = useQuery({
    queryKey: ["recent-activity"],
    queryFn: async () => {
      try {
        const res = await apiClient.get<AuditEvent[]>("/api/audit/events", {
          params: { limit: 5 },
        });
        return res.data;
      } catch {
        return [];
      }
    },
  });

  const roleLabel =
    user?.role === "admin"
      ? "Administrator"
      : user?.role === "reviewer"
        ? "Claims Reviewer"
        : user?.role === "analyst"
          ? "Analyst"
          : "User";

  return (
    <div className="space-y-6">
      {/* Greeting Section */}
      <div>
        <h1 className="text-2xl font-semibold">
          {greeting}, {user?.name || "there"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {roleLabel} · ClaimGuard Dashboard
        </p>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {quickActions.map((action) => (
            <QuickActionCard key={action.href} {...action} />
          ))}
        </div>
      </div>

      {/* KPI Stats */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">
          Key Metrics
        </h2>
        {isLoading || !data ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="pt-4">
                  <div className="h-3 w-20 bg-muted rounded mb-2" />
                  <div className="h-7 w-16 bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <StatCard
              label="Total Cases"
              value={data.total_cases.toLocaleString()}
              icon={FileCheck}
            />
            <StatCard
              label="In Review"
              value={data.in_review}
              icon={Clock}
            />
            <StatCard
              label="Auto Rate"
              value={`${data.auto_decision_rate.toFixed(1)}%`}
              icon={TrendingUp}
            />
            <StatCard
              label="Avg. Fraud Score"
              value={
                data.avg_fraud_score != null
                  ? data.avg_fraud_score.toFixed(1)
                  : "—"
              }
              icon={Target}
            />
            <StatCard
              label="SLA Compliance"
              value={`${data.sla_compliance_rate.toFixed(1)}%`}
              icon={Shield}
            />
            <StatCard
              label="Champion Model"
              value={data.current_champion_model ?? "None"}
              icon={Brain}
            />
          </div>
        )}
      </div>

      {/* Recent Activity & Status Breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent Activity Feed */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity && recentActivity.length > 0 ? (
              <div className="divide-y">
                {recentActivity.map((event) => (
                  <RecentActivityItem key={event.id} event={event} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No recent activity
              </p>
            )}
          </CardContent>
        </Card>

        {/* Cases by Status */}
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
                  const percentage =
                    data.total_cases > 0
                      ? ((count as number) / data.total_cases) * 100
                      : 0;
                  return (
                    <div key={status} className="flex items-center gap-2">
                      <span className="text-sm capitalize w-28 truncate">
                        {status.replace(/_/g, " ")}
                      </span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground w-12 text-right">
                        {count as number}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Loading...
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
