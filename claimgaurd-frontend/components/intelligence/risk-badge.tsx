import { cn } from "@/lib/utils";
import { RISK_BG_CLASSES } from "@/lib/constants";
import type { RiskBand, FraudBand } from "@/lib/types";

export function RiskBadge({
  band,
  score,
  className,
}: {
  band?: RiskBand | FraudBand | string | null;
  score?: number | null;
  className?: string;
}) {
  if (!band && score == null) return <span className="text-muted-foreground text-xs">—</span>;

  const resolvedBand = band?.toLowerCase() ??
    (score != null
      ? score >= 80 ? "critical"
        : score >= 60 ? "high"
        : score >= 40 ? "medium"
        : "low"
      : "low");

  const label = resolvedBand.charAt(0).toUpperCase() + resolvedBand.slice(1);

  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
      RISK_BG_CLASSES[resolvedBand] ?? "bg-slate-100 text-slate-600",
      className,
    )}>
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {label}
    </span>
  );
}
