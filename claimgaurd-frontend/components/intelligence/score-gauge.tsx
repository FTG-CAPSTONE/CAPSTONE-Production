"use client";

import { useEffect, useRef } from "react";
import { RISK_COLOURS } from "@/lib/constants";
import type { FraudBand, RiskBand } from "@/lib/types";

function describeArc(
  cx: number, cy: number, r: number,
  startDeg: number, endDeg: number,
): string {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startDeg));
  const y1 = cy + r * Math.sin(toRad(startDeg));
  const x2 = cx + r * Math.cos(toRad(endDeg));
  const y2 = cy + r * Math.sin(toRad(endDeg));
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

function bandFromScore(score: number): FraudBand {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "medium";
  return "low";
}

interface ScoreGaugeProps {
  score: number | null | undefined;
  band?: RiskBand | FraudBand | null;
  confidence?: number | null;
  size?: number;
}

export function ScoreGauge({ score, band, confidence, size = 140 }: ScoreGaugeProps) {
  const counterRef = useRef<SVGTSpanElement>(null);

  const safeScore = score != null ? Math.min(100, Math.max(0, Number(score))) : null;
  const resolvedBand = band?.toLowerCase() ?? (safeScore != null ? bandFromScore(safeScore) : "low");
  const colour = RISK_COLOURS[resolvedBand] ?? RISK_COLOURS.low;

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  const strokeW = size * 0.09;

  // Arc runs from 135° to 405° (270° sweep)
  const START = 135;
  const SWEEP = 270;
  const trackPath = describeArc(cx, cy, r, START, START + SWEEP);
  const activeSweep = safeScore != null ? (safeScore / 100) * SWEEP : 0;
  const activePath = activeSweep > 1 ? describeArc(cx, cy, r, START, START + activeSweep) : null;

  // Animate counter
  useEffect(() => {
    if (!counterRef.current || safeScore == null) return;
    const target = Math.round(safeScore);
    let frame = 0;
    const total = 40;
    const timer = setInterval(() => {
      frame++;
      const v = Math.round((frame / total) * target);
      if (counterRef.current) counterRef.current.textContent = String(Math.min(v, target));
      if (frame >= total) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [safeScore]);

  const bandLabel = resolvedBand.charAt(0).toUpperCase() + resolvedBand.slice(1);

  return (
    <div
      className="flex flex-col items-center"
      role="img"
      aria-label={`Fraud score: ${safeScore ?? "—"} out of 100, band: ${bandLabel}`}
    >
      <svg width={size} height={size * 0.72} viewBox={`0 0 ${size} ${size}`} overflow="visible">
        {/* Track */}
        <path
          d={trackPath}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.1}
          strokeWidth={strokeW}
          strokeLinecap="round"
        />
        {/* Active arc */}
        {activePath && (
          <path
            d={activePath}
            fill="none"
            stroke={colour}
            strokeWidth={strokeW}
            strokeLinecap="round"
          />
        )}
        {/* Score text */}
        <text
          x={cx}
          y={cy + 8}
          textAnchor="middle"
          fontSize={size * 0.22}
          fontWeight="700"
          fill={safeScore != null ? colour : "currentColor"}
          opacity={safeScore != null ? 1 : 0.3}
        >
          {safeScore != null ? (
            <tspan ref={counterRef}>
              {Math.round(safeScore)}
            </tspan>
          ) : "—"}
        </text>
        {/* /100 */}
        {safeScore != null && (
          <text
            x={cx}
            y={cy + 8 + size * 0.14}
            textAnchor="middle"
            fontSize={size * 0.09}
            fill="currentColor"
            opacity={0.4}
          >
            / 100
          </text>
        )}
      </svg>
      {/* Band label */}
      <span
        className="mt-1 text-xs font-semibold uppercase tracking-wide"
        style={{ color: colour }}
      >
        {bandLabel}
      </span>
      {confidence != null && (
        <span className="mt-0.5 text-xs text-muted-foreground">
          {(Number(confidence) * 100).toFixed(0)}% confidence
        </span>
      )}
    </div>
  );
}
