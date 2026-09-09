"use client";

import type { ShapFeature } from "@/lib/types";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface ShapExplanationProps {
  features: ShapFeature[];
  maxFeatures?: number;
  className?: string;
}

export function ShapExplanation({
  features,
  maxFeatures = 8,
  className,
}: ShapExplanationProps) {
  if (!features?.length) return null;

  // If the only entry is a note (no actual SHAP values), show it plainly
  if (features.length === 1 && features[0].note && features[0].impact == null) {
    return (
      <p className="text-sm italic text-muted-foreground">{features[0].note}</p>
    );
  }

  // Sort by absolute impact and take top N
  const sortedFeatures = [...features]
    .filter((f) => f.impact != null)
    .sort((a, b) => Math.abs(b.impact ?? 0) - Math.abs(a.impact ?? 0))
    .slice(0, maxFeatures);

  if (!sortedFeatures.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No SHAP explanation available.
      </p>
    );
  }

  const maxAbs = Math.max(
    ...sortedFeatures.map((f) => Math.abs(f.impact ?? 0)),
    0.001
  );

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Risk Drivers (SHAP)</h4>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-red-500" />
            Increases risk
          </span>
          <span className="flex items-center gap-1">
            <TrendingDown className="h-3 w-3 text-green-500" />
            Decreases risk
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {sortedFeatures.map((f, i) => {
          const impact = f.impact ?? 0;
          const pct = (Math.abs(impact) / maxAbs) * 100;
          const positive = impact >= 0;

          return (
            <div key={i} className="group">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-muted-foreground truncate max-w-[200px]">
                  {f.feature ?? "Unknown feature"}
                </span>
                <span
                  className={cn(
                    "font-mono text-xs font-medium",
                    positive ? "text-red-600" : "text-green-600"
                  )}
                >
                  {impact > 0 ? "+" : ""}
                  {impact.toFixed(3)}
                </span>
              </div>
              <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                {/* Center line indicator */}
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border z-10" />
                {/* Bar - positioned from center */}
                <div
                  className={cn(
                    "absolute top-0 bottom-0 rounded-full transition-all duration-300",
                    positive
                      ? "bg-red-500 left-1/2"
                      : "bg-green-500 right-1/2"
                  )}
                  style={{
                    width: `${pct / 2}%`,
                    [positive ? "left" : "right"]: "50%",
                  }}
                />
              </div>
              {f.value != null && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Value: {typeof f.value === "number" ? f.value.toFixed(2) : f.value}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
