"use client";

import type { RuleEvaluation } from "@/lib/types";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

const ICON_MAP: Record<string, React.ReactNode> = {
  hard_fail: <XCircle className="h-4 w-4 text-red-600 shrink-0" />,
  soft_flag: <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />,
  pass:      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />,
};

const BADGE_MAP: Record<string, string> = {
  hard_fail: "bg-red-100 text-red-700",
  soft_flag: "bg-amber-100 text-amber-700",
  pass:      "bg-emerald-100 text-emerald-700",
};

export function RuleFlagsList({ rules }: { rules: RuleEvaluation[] }) {
  if (!rules.length)
    return <p className="text-sm text-slate-500">No rule evaluations recorded.</p>;

  return (
    <ul className="space-y-2">
      {rules.map((r) => (
        <li key={r.rule_code} className="flex items-start gap-2 text-sm">
          {ICON_MAP[r.result] ?? null}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{r.rule_code.replace(/_/g, " ")}</span>
              <span
                className={`rounded px-1.5 py-0.5 text-xs ${
                  BADGE_MAP[r.result] ?? "bg-slate-100 text-slate-600"
                }`}
              >
                {r.result.replace("_", " ")}
              </span>
            </div>
            {/* description is the correct backend field (was: message) */}
            {r.description && (
              <p className="text-xs text-slate-500">{r.description}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
