"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  ReferenceLine,
  Tooltip,
} from "recharts";
import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { AlertCircleIcon } from "lucide-react";
import type { MLPredictionSummary, ShapFeature } from "@/lib/types";

const chartConfig: ChartConfig = {
  impact: {
    label: "SHAP Impact",
    color: "var(--color-primary)",
  },
};

function normaliseFeatures(
  features: MLPredictionSummary["top_features"],
): ShapFeature[] {
  return (features ?? [])
    .filter((f) => f.feature && f.impact != null)
    .sort((a, b) => Math.abs(b.impact!) - Math.abs(a.impact!))
    .slice(0, 7)
    .map((f) => ({
      feature: f.feature!,
      impact: Number(f.impact),
      value: (f as ShapFeature).value,
      direction: (f as ShapFeature).direction,
      note: f.note,
    }));
}

export function ShapBarChart({
  prediction,
}: {
  prediction: MLPredictionSummary;
}) {
  // No-champion model note state
  if (prediction.note && (!prediction.top_features || prediction.top_features.length === 0)) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/20">
        <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-amber-600" />
        <p className="text-sm text-amber-800 dark:text-amber-300">{prediction.note}</p>
      </div>
    );
  }

  const features = normaliseFeatures(prediction.top_features);
  if (!features.length) return null;

  const data = features.map((f) => ({
    feature: f.feature.replace(/_/g, " "),
    impact: f.impact,
  }));

  return (
    <div>
      <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground font-medium">
        Top Risk Drivers (SHAP)
      </p>
      <ChartContainer config={chartConfig} className="h-[200px] w-full">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 20, bottom: 0, left: 0 }}
        >
          <CartesianGrid horizontal={false} strokeDasharray="3 3" strokeOpacity={0.3} />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            tickFormatter={(v) => v.toFixed(2)}
          />
          <YAxis
            type="category"
            dataKey="feature"
            tickLine={false}
            axisLine={false}
            width={140}
            fontSize={11}
          />
          <ReferenceLine x={0} stroke="currentColor" strokeOpacity={0.2} />
          <Tooltip content={<ChartTooltipContent />} />
          <Bar dataKey="impact" radius={3}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.impact >= 0 ? "#ea580c" : "#16a34a"}
                fillOpacity={0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
      <p className="mt-1 text-xs text-muted-foreground">
        Positive = increases fraud risk · Negative = decreases fraud risk
      </p>
    </div>
  );
}
