import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  iconClass?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  className?: string;
}

export function StatCard({
  label, value, sub, icon: Icon, iconClass,
  trend, trendValue, className,
}: StatCardProps) {
  return (
    <div className={cn(
      "rounded-xl border border-border bg-card p-5 flex flex-col gap-3",
      className,
    )}>
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
          {label}
        </p>
        {Icon && (
          <span className={cn(
            "flex size-8 items-center justify-center rounded-lg",
            iconClass ?? "bg-muted text-muted-foreground",
          )}>
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </div>
      {trendValue && (
        <p className={cn("text-xs font-medium", {
          "text-emerald-600 dark:text-emerald-400": trend === "up",
          "text-red-600 dark:text-red-400": trend === "down",
          "text-muted-foreground": trend === "neutral" || !trend,
        })}>
          {trend === "up" && "↑ "}
          {trend === "down" && "↓ "}
          {trendValue}
        </p>
      )}
    </div>
  );
}
