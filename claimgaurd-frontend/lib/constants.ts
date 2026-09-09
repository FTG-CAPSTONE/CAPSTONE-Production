import type { CaseStatus, FraudBand, RiskBand } from "./types";

// ── Status labels ──────────────────────────────────────────────────────────
export const STATUS_LABELS: Record<string, string> = {
  received:         "Received",
  processing:       "Processing",
  auto_approved:    "Auto Approved",
  auto_rejected:    "Auto Rejected",
  auto_rejected_rule: "Auto Rejected",
  in_review:        "In Review",
  approved:         "Approved",
  human_approve:    "Approved",
  declined:         "Declined",
  human_decline:    "Declined",
  rejected:         "Rejected",
  closed:           "Closed",
  human_escalate:   "Escalated",
  new:              "New",
};

// ── Status colour classes (Tailwind) ──────────────────────────────────────
export const STATUS_CLASSES: Record<string, string> = {
  received:         "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  processing:       "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  auto_approved:    "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  auto_rejected:    "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  auto_rejected_rule:"bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  in_review:        "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  approved:         "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  human_approve:    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  declined:         "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  human_decline:    "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  rejected:         "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  closed:           "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400",
  human_escalate:   "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  new:              "bg-slate-100 text-slate-600",
};

// ── Risk band colours ──────────────────────────────────────────────────────
export const RISK_COLOURS: Record<string, string> = {
  low:      "#16a34a",
  medium:   "#ca8a04",
  high:     "#ea580c",
  critical: "#dc2626",
  Low:      "#16a34a",
  Medium:   "#ca8a04",
  High:     "#ea580c",
  Critical: "#dc2626",
};

export const RISK_BG_CLASSES: Record<string, string> = {
  low:      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  medium:   "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  high:     "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  critical: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  Low:      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  Medium:   "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  High:     "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  Critical: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

// ── Priority colour for HITL queue ────────────────────────────────────────
export function priorityColour(score: number): string {
  if (score >= 80) return "text-red-600";
  if (score >= 40) return "text-orange-500";
  return "text-amber-500";
}

export function priorityRowClass(score: number): string {
  if (score >= 80) return "bg-red-50 dark:bg-red-950/20";
  if (score >= 40) return "bg-orange-50 dark:bg-orange-950/20";
  return "bg-amber-50 dark:bg-amber-950/20";
}

// ── Event type human labels ────────────────────────────────────────────────
export const EVENT_LABELS: Record<string, string> = {
  case_ingested:     "Case Ingested",
  etl_completed:     "ETL Completed",
  rules_evaluated:   "Rules Evaluated",
  ml_scored:         "ML Scored",
  routed_to_hitl:    "Routed to Review",
  auto_approved:     "Auto Approved",
  auto_rejected:     "Auto Rejected",
  case_opened:       "Case Opened",
  decision_recorded: "Decision Recorded",
  investigation_opened: "Investigation Opened",
  investigation_closed: "Investigation Closed",
  document_uploaded: "Document Uploaded",
};

// ── LOB labels ─────────────────────────────────────────────────────────────
export const LOB_LABELS: Record<string, string> = {
  motor:       "Motor",
  health:      "Health",
  marine_cargo:"Marine Cargo",
  general:     "General",
};

// ── Currency formatter (KES) ───────────────────────────────────────────────
export function fmtKES(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function fmtNumber(n: number | null | undefined, decimals = 0): string {
  if (n == null) return "—";
  return Number(n).toLocaleString("en-KE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function fmtPercent(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${(Number(n) * 100).toFixed(1)}%`;
}
