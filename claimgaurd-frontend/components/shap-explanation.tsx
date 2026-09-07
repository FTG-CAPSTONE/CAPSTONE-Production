import type { MLPredictionSummary } from "@/lib/types";
import { RiskBadge } from "./risk-badge";

export function ShapExplanation({ prediction }: { prediction: MLPredictionSummary }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <span className="text-2xl font-semibold">{prediction.score.toFixed(1)}</span>
        <RiskBadge band={prediction.band} />
      </div>
      {prediction.confidence !== null && (
        <p className="mt-1 text-xs text-slate-500">
          Model confidence: {(prediction.confidence * 100).toFixed(0)}%
        </p>
      )}
      <div className="mt-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Top drivers</p>
        <ul className="mt-1 space-y-1">
          {prediction.top_features.map((f, i) => (
            <li key={i} className="text-sm text-slate-700">
              {f.feature ? (
                <>
                  {f.feature}{" "}
                  <span className={Number(f.impact) >= 0 ? "text-red-600" : "text-emerald-600"}>
                    ({Number(f.impact) >= 0 ? "+" : ""}
                    {f.impact})
                  </span>
                </>
              ) : (
                f.note
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
