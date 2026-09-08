"use client";

import type { ShapFeature } from "@/lib/types";

export function ShapExplanation({ features }: { features: ShapFeature[] }) {
  if (!features?.length) return null;

  // If the only entry is a note (no actual SHAP values), show it plainly
  if (features.length === 1 && features[0].note && features[0].impact == null) {
    return <p className="text-xs italic text-slate-500">{features[0].note}</p>;
  }

  const maxAbs = Math.max(...features.map((f) => Math.abs(f.impact ?? 0)), 0.001);

  return (
    <div className="space-y-1">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        Top risk drivers
      </p>
      {features.map((f, i) => {
        const impact = f.impact ?? 0;
        const pct = (Math.abs(impact) / maxAbs) * 100;
        const positive = impact >= 0;
        return (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-36 truncate text-slate-600">{f.feature ?? "—"}</span>
            <div className="flex-1 h-2 rounded bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded ${positive ? "bg-red-400" : "bg-emerald-400"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span
              className={`w-14 text-right tabular-nums ${
                positive ? "text-red-600" : "text-emerald-600"
              }`}
            >
              {impact > 0 ? "+" : ""}
              {impact.toFixed(3)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
