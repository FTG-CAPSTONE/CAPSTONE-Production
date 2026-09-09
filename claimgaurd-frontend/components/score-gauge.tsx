"use client";

import { cn } from "@/lib/utils";
import type { FraudBand } from "@/lib/types";

interface ScoreGaugeProps {
  score: number;
  band?: FraudBand | null;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

const bandColors: Record<FraudBand, { stroke: string; fill: string; text: string }> = {
  low: { stroke: "stroke-green-500", fill: "fill-green-500", text: "text-green-600" },
  medium: { stroke: "stroke-amber-500", fill: "fill-amber-500", text: "text-amber-600" },
  high: { stroke: "stroke-orange-500", fill: "fill-orange-500", text: "text-orange-600" },
  critical: { stroke: "stroke-red-500", fill: "fill-red-500", text: "text-red-600" },
};

function getBandFromScore(score: number): FraudBand {
  if (score < 30) return "low";
  if (score < 60) return "medium";
  if (score < 80) return "high";
  return "critical";
}

export function ScoreGauge({
  score,
  band,
  size = "md",
  showLabel = true,
  className,
}: ScoreGaugeProps) {
  const effectiveBand = band ?? getBandFromScore(score);
  const colors = bandColors[effectiveBand];
  
  const sizes = {
    sm: { width: 80, stroke: 6, fontSize: "text-lg" },
    md: { width: 120, stroke: 8, fontSize: "text-2xl" },
    lg: { width: 160, stroke: 10, fontSize: "text-3xl" },
  };
  
  const { width, stroke, fontSize } = sizes[size];
  const radius = (width - stroke) / 2;
  const circumference = radius * Math.PI; // Half circle
  const progress = Math.min(100, Math.max(0, score)) / 100;
  const offset = circumference * (1 - progress);
  
  return (
    <div className={cn("flex flex-col items-center", className)}>
      <svg
        width={width}
        height={width / 2 + 10}
        viewBox={`0 0 ${width} ${width / 2 + 10}`}
        className="overflow-visible"
      >
        {/* Background arc */}
        <path
          d={`M ${stroke / 2} ${width / 2} A ${radius} ${radius} 0 0 1 ${width - stroke / 2} ${width / 2}`}
          fill="none"
          className="stroke-muted"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        {/* Progress arc */}
        <path
          d={`M ${stroke / 2} ${width / 2} A ${radius} ${radius} 0 0 1 ${width - stroke / 2} ${width / 2}`}
          fill="none"
          className={colors.stroke}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.5s ease-out" }}
        />
        {/* Score text */}
        <text
          x={width / 2}
          y={width / 2 - 5}
          textAnchor="middle"
          className={cn("font-bold", fontSize, colors.text)}
          style={{ fill: "currentColor" }}
        >
          {Math.round(score)}
        </text>
      </svg>
      {showLabel && (
        <div className="mt-1 text-center">
          <span className={cn("text-sm font-medium capitalize", colors.text)}>
            {effectiveBand} Risk
          </span>
        </div>
      )}
    </div>
  );
}
