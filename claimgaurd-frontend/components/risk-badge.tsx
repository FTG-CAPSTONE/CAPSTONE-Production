import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { FraudBand } from "@/lib/types";

const bandConfig: Record<FraudBand, { label: string; className: string }> = {
  low: {
    label: "Low",
    className: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
  },
  medium: {
    label: "Medium",
    className: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  },
  high: {
    label: "High",
    className: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800",
  },
  critical: {
    label: "Critical",
    className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
  },
};

interface RiskBadgeProps {
  band: FraudBand | null | undefined;
  score?: string | number | null;
  showScore?: boolean;
  className?: string;
}

export function RiskBadge({ band, score, showScore = false, className }: RiskBadgeProps) {
  if (!band) return <span className="text-muted-foreground">—</span>;
  
  const config = bandConfig[band] ?? {
    label: band,
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  };

  const displayText = showScore && score != null
    ? `${parseFloat(String(score)).toFixed(0)} (${config.label})`
    : config.label;

  return (
    <Badge
      variant="outline"
      className={cn("font-medium", config.className, className)}
    >
      {displayText}
    </Badge>
  );
}
