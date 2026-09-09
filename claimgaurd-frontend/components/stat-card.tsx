import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  delta?: number;
  deltaLabel?: string;
  icon?: LucideIcon;
  className?: string;
}

export function StatCard({
  label,
  value,
  delta,
  deltaLabel,
  icon: Icon,
  className,
}: StatCardProps) {
  const DeltaIcon =
    delta === undefined
      ? null
      : delta > 0
        ? TrendingUp
        : delta < 0
          ? TrendingDown
          : Minus;

  const deltaColor =
    delta === undefined
      ? ""
      : delta > 0
        ? "text-success"
        : delta < 0
          ? "text-destructive"
          : "text-muted-foreground";

  return (
    <Card className={cn("", className)}>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        </div>
        <p className="mt-2 text-2xl font-semibold">{value}</p>
        {delta !== undefined && (
          <div className={cn("mt-2 flex items-center gap-1 text-xs", deltaColor)}>
            {DeltaIcon && <DeltaIcon className="h-3 w-3" />}
            <span>
              {delta > 0 ? "+" : ""}
              {delta}%
            </span>
            {deltaLabel && (
              <span className="text-muted-foreground">{deltaLabel}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
