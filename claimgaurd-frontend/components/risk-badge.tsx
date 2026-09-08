import type { FraudBand } from "@/lib/types";

// Backend returns lowercase band values: low | medium | high | critical
const STYLES: Record<FraudBand, string> = {
  low:      "bg-emerald-100 text-emerald-800 border-emerald-300",
  medium:   "bg-amber-100 text-amber-800 border-amber-300",
  high:     "bg-orange-100 text-orange-800 border-orange-300",
  critical: "bg-red-100 text-red-800 border-red-300",
};

export function RiskBadge({ band }: { band: FraudBand }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${
        STYLES[band] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {band}
    </span>
  );
}
