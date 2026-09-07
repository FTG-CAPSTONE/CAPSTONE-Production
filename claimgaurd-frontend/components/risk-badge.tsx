import type { RiskBand } from "@/lib/types";

const STYLES: Record<RiskBand, string> = {
  Low: "bg-emerald-100 text-emerald-800 border-emerald-300",
  Medium: "bg-amber-100 text-amber-800 border-amber-300",
  High: "bg-orange-100 text-orange-800 border-orange-300",
  Critical: "bg-red-100 text-red-800 border-red-300",
};

export function RiskBadge({ band }: { band: RiskBand }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STYLES[band]}`}
    >
      {band}
    </span>
  );
}
