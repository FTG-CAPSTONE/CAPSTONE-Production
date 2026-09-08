"use client";

import Link from "next/link";
import type { CaseSummary, FraudBand } from "@/lib/types";

const STATUS_BADGE: Record<string, string> = {
  received:      "bg-slate-100 text-slate-600",
  processing:    "bg-blue-100 text-blue-700",
  in_review:     "bg-amber-100 text-amber-700",
  auto_approved: "bg-emerald-100 text-emerald-700",
  auto_rejected: "bg-red-100 text-red-700",
  approved:      "bg-green-100 text-green-700",
  declined:      "bg-orange-100 text-orange-700",
  closed:        "bg-zinc-100 text-zinc-600",
};

const BAND_BADGE: Record<FraudBand, string> = {
  low:      "bg-green-50 text-green-700",
  medium:   "bg-amber-50 text-amber-700",
  high:     "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700 font-semibold",
};

export function CaseTable({ cases }: { cases: CaseSummary[] }) {
  if (!cases.length) {
    return <p className="p-6 text-sm text-slate-500">No cases match this filter.</p>;
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
          <th className="py-2 pr-4">Reference</th>
          <th className="py-2 pr-4">Type</th>
          <th className="py-2 pr-4">Amount</th>
          <th className="py-2 pr-4">Score</th>
          <th className="py-2 pr-4">Status</th>
          <th className="py-2" />
        </tr>
      </thead>
      <tbody>
        {cases.map((c) => (
          <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
            {/* external_claim_id — correct backend field */}
            <td className="py-2 pr-4 font-mono text-xs">
              {c.external_claim_id ? c.external_claim_id.slice(-12) : c.id.slice(0, 8)}
            </td>
            <td className="py-2 pr-4 capitalize">
              {c.claim_type?.replace(/_/g, " ") ?? c.line_of_business}
            </td>
            {/* amount_claimed — Decimal serialised as string */}
            <td className="py-2 pr-4 tabular-nums">
              {c.amount_claimed
                ? `KES ${parseFloat(c.amount_claimed).toLocaleString()}`
                : "—"}
            </td>
            <td className="py-2 pr-4">
              {c.fraud_score != null ? (
                <span
                  className={`rounded px-1.5 py-0.5 text-xs ${
                    BAND_BADGE[c.fraud_band ?? "low"] ?? ""
                  }`}
                >
                  {parseFloat(c.fraud_score).toFixed(0)}
                </span>
              ) : (
                "—"
              )}
            </td>
            <td className="py-2 pr-4">
              <span
                className={`rounded px-2 py-0.5 text-xs ${
                  STATUS_BADGE[c.status] ?? "bg-slate-100 text-slate-600"
                }`}
              >
                {c.status.replace(/_/g, " ")}
              </span>
            </td>
            <td className="py-2 text-right">
              <Link
                href={`/cases/${c.id}`}
                className="text-xs text-blue-700 hover:underline"
              >
                View →
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
