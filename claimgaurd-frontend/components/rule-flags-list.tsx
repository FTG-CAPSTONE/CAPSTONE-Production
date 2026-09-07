import type { RuleResult } from "@/lib/types";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

const ICON = {
  hard_block: <XCircle className="h-4 w-4 text-red-600" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-600" />,
  info: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
};

export function RuleFlagsList({ rules }: { rules: RuleResult[] }) {
  if (!rules.length) return <p className="text-sm text-slate-500">No rule evaluations recorded.</p>;
  return (
    <ul className="space-y-2">
      {rules.map((r) => (
        <li key={r.rule_code} className="flex items-start gap-2 text-sm">
          {ICON[r.severity]}
          <div>
            <span className="font-medium">{r.rule_code}</span>
            <span className="text-slate-600"> — {r.message}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
