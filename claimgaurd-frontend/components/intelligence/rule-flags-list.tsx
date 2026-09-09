"use client";

import { useState } from "react";
import { CheckCircle2Icon, AlertTriangleIcon, XCircleIcon, ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RuleResult } from "@/lib/types";

function RuleIcon({ result, severity }: { result: string; severity: string }) {
  const pass = result === "pass" || result === "passed" || result === "PASS";
  if (pass) return <CheckCircle2Icon className="size-4 text-emerald-500 shrink-0" />;
  if (severity === "hard_block" || severity === "critical" || result === "hard_fail")
    return <XCircleIcon className="size-4 text-red-500 shrink-0" />;
  return <AlertTriangleIcon className="size-4 text-amber-500 shrink-0" />;
}

function RuleRow({ rule }: { rule: RuleResult }) {
  const [open, setOpen] = useState(false);
  const pass = rule.passed === "pass" || rule.result === "pass";
  const hasDetail = !!rule.triggered_value && Object.keys(rule.triggered_value).length > 0;

  return (
    <div className={cn(
      "rounded-lg border px-3 py-2.5",
      pass
        ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/30 dark:bg-emerald-950/10"
        : rule.severity === "hard_block" || rule.severity === "critical"
        ? "border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-950/10"
        : "border-amber-200 bg-amber-50/50 dark:border-amber-900/30 dark:bg-amber-950/10",
    )}>
      <div className="flex items-start gap-2">
        <RuleIcon result={rule.passed ?? rule.result ?? ""} severity={rule.severity ?? "info"} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium font-mono">
              {rule.rule_code}
            </span>
            {!pass && (
              <span className={cn(
                "text-xs rounded px-1.5 py-0.5 font-medium",
                rule.severity === "hard_block" || rule.severity === "critical"
                  ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
              )}>
                {rule.severity === "hard_block" || rule.severity === "critical" ? "HARD FAIL" : "SOFT FLAG"}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {rule.message ?? rule.description ?? ""}
          </p>
          {hasDetail && (
            <>
              <button
                onClick={() => setOpen((v) => !v)}
                className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                {open ? <ChevronDownIcon className="size-3" /> : <ChevronRightIcon className="size-3" />}
                Details
              </button>
              {open && (
                <pre className="mt-1.5 overflow-x-auto rounded bg-muted/50 px-2 py-1.5 text-xs">
                  {JSON.stringify(rule.triggered_value, null, 2)}
                </pre>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function RuleFlagsList({ rules }: { rules: RuleResult[] }) {
  const [showPassed, setShowPassed] = useState(false);

  if (!rules?.length) {
    return <p className="text-sm text-muted-foreground">No rules evaluated.</p>;
  }

  const failures = rules.filter((r) => r.passed !== "pass" && r.result !== "pass");
  const passes = rules.filter((r) => r.passed === "pass" || r.result === "pass");

  return (
    <div className="space-y-2">
      {failures.map((r, i) => <RuleRow key={i} rule={r} />)}
      {passes.length > 0 && (
        <>
          <button
            onClick={() => setShowPassed((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-1"
          >
            {showPassed ? <ChevronDownIcon className="size-3" /> : <ChevronRightIcon className="size-3" />}
            {passes.length} rule{passes.length > 1 ? "s" : ""} passed
          </button>
          {showPassed && passes.map((r, i) => <RuleRow key={`p-${i}`} rule={r} />)}
        </>
      )}
    </div>
  );
}
