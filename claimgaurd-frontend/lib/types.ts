/** Mirrors the response shapes of the verified ClaimGuard backend exactly
 * (see the router.py files under claimguard-backend/app). Keep in sync
 * manually until the backend's OpenAPI spec is used to codegen this file. */

export type CaseStatus =
  | "new" | "processing" | "in_review" | "auto_approved"
  | "auto_rejected_rule" | "rejected" | "human_approve" | "human_decline" | "human_escalate";

export type RiskBand = "Low" | "Medium" | "High" | "Critical";

export interface CaseSummary {
  id: string;
  external_ref: string;
  case_type: "application" | "claim";
  line_of_business: "motor" | "health" | "marine_cargo" | "general";
  status: CaseStatus;
  amount: number;
}

export interface RuleResult {
  rule_code: string;
  passed: "pass" | "fail" | "soft_flag";
  severity: "info" | "warning" | "hard_block";
  message: string;
}

export interface MLPredictionSummary {
  score: number;
  band: RiskBand;
  confidence: number | null;
  top_features: Array<{ feature?: string; impact?: number; note?: string }>;
}

export interface CaseDetail {
  id: string;
  external_ref: string;
  status: CaseStatus;
  line_of_business: string;
  amount: number;
  feature_snapshot: Record<string, unknown>;
  predictions: MLPredictionSummary[];
  rules: RuleResult[];
}

export interface ReviewQueueItem {
  id: string;
  case_id: string;
  priority_score: number;
  reason: string;
}

export interface ModelRegistryEntry {
  id: string;
  model_family: string;
  version: string;
  algorithm: string;
  status: "challenger" | "champion" | "rejected" | "retired";
  precision: number | null;
  recall: number | null;
  f1_score: number | null;
  auc_roc: number | null;
}

export interface MLOverview {
  champion: ModelRegistryEntry | null;
  challengers_awaiting_review: ModelRegistryEntry[];
}

export interface TrainingRunSummary {
  id: string;
  model_registry_id: string;
  status: string;
  rows_used: number;
  metrics: Record<string, number | null>;
}

export interface AnalyticsOverview {
  total_cases: number;
  cases_by_status: Record<string, number>;
  cases_by_line_of_business: Record<string, number>;
  average_fraud_score: number | null;
  current_champion_model: string | null;
}

export interface AuditEvent {
  event_type: string;
  actor: string;
  payload: Record<string, unknown>;
  occurred_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}
