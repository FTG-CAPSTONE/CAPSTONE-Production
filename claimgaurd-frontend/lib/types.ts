/** Full type definitions mirroring ClaimGuard backend response shapes.
 *  Keep in sync with claimgaurd-backend/app until OpenAPI codegen is set up. */

export type Role =
  | "admin" | "underwriter" | "adjuster" | "investigator"
  | "ml_admin" | "compliance" | "corporate_risk" | "viewer";

export interface CurrentUser {
  id: string;
  username: string;
  full_name: string;
  role: Role;
}

export type CaseStatus =
  | "received" | "processing" | "auto_approved" | "auto_rejected"
  | "in_review" | "approved" | "declined" | "closed"
  // legacy values still returned by backend
  | "new" | "auto_rejected_rule" | "rejected"
  | "human_approve" | "human_decline" | "human_escalate";

export type RiskBand = "Low" | "Medium" | "High" | "Critical";
export type FraudBand = "low" | "medium" | "high" | "critical";

export interface CaseSummary {
  id: string;
  external_ref: string;
  case_type: "application" | "claim";
  line_of_business: "motor" | "health" | "marine_cargo" | "general";
  status: CaseStatus;
  amount: number;
  fraud_score?: number | null;
  fraud_band?: FraudBand | null;
  submitted_at?: string;
}

export interface ShapFeature {
  feature: string;
  impact: number;
  value?: string | number;
  direction?: "increases_risk" | "decreases_risk";
  note?: string;
}

export interface MLPredictionSummary {
  id?: string;
  score: number;
  band: RiskBand | FraudBand;
  confidence: number | null;
  top_features: ShapFeature[];
  model_version?: string;
  predicted_at?: string;
  note?: string;
}

export interface RuleResult {
  rule_code: string;
  passed: "pass" | "fail" | "soft_flag";
  result?: "pass" | "soft_flag" | "hard_fail";
  severity: "info" | "warning" | "hard_block" | "critical";
  message: string;
  description?: string;
  triggered_value?: Record<string, unknown> | null;
}

export interface ReviewDecision {
  id: string;
  case_id: string;
  reviewer_id: string;
  reviewer_name: string;
  decision: "approved" | "declined" | "escalated" | "request_docs";
  rationale: string;
  decided_at: string;
}

export interface CaseEvent {
  id?: string;
  case_id?: string;
  event_type: string;
  actor: string;
  payload: Record<string, unknown>;
  occurred_at: string;
}

export interface PartySummary {
  id: string;
  full_name: string;
  id_number: string | null;
  phone: string | null;
  county: string | null;
}

export interface PolicySummary {
  id: string;
  external_id: string | null;
  product_line: string;
  motor_class: string | null;
  sum_insured: number;
  premium: number;
  start_date: string;
  end_date: string;
  status: string;
}

export interface Document {
  id: string;
  doc_type: string;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  uploaded_at: string;
  download_url: string;
}

export interface ReviewQueueItem {
  id: string;
  case_id: string;
  priority_score: number;
  reason: string;
  assigned_to?: string | null;
  status?: "pending" | "in_review" | "completed" | "escalated";
  created_at?: string;
  amount?: number;
}

export interface CaseDetail {
  id: string;
  external_ref: string;
  status: CaseStatus;
  line_of_business: string;
  amount: number;
  case_type?: string;
  fraud_score?: number | null;
  fraud_band?: FraudBand | null;
  confidence?: number | null;
  submitted_at?: string;
  incident_date?: string;
  reported_date?: string;
  notes?: string | null;
  feature_snapshot: Record<string, unknown>;
  predictions: MLPredictionSummary[];
  rules: RuleResult[];
  policy?: PolicySummary;
  claimant?: PartySummary;
  provider?: PartySummary | null;
  documents?: Document[];
  queue_item?: ReviewQueueItem | null;
  latest_decision?: ReviewDecision | null;
  audit_events?: CaseEvent[];
}

export interface ModelRegistryEntry {
  id: string;
  model_family: string;
  version: string;
  algorithm: string;
  status: "challenger" | "champion" | "rejected" | "retired" | "archived";
  precision: number | null;
  recall: number | null;
  f1_score: number | null;
  auc_roc: number | null;
  false_positive_rate?: number | null;
  trained_rows?: number | null;
  promoted_at?: string | null;
  created_at?: string;
}

export interface MLOverview {
  champion: ModelRegistryEntry | null;
  challengers_awaiting_review: ModelRegistryEntry[];
  override_rate_30d?: number | null;
  avg_confidence_hitl?: number | null;
}

export interface TrainingRunSummary {
  id: string;
  model_registry_id: string | null;
  status: "running" | "completed" | "failed" | string;
  rows_used: number;
  fraud_rate?: number | null;
  started_at?: string;
  completed_at?: string | null;
  error_message?: string | null;
  metrics: Record<string, number | null>;
}

export interface MLFeedbackItem {
  id: string;
  case_id: string;
  score: number;
  confidence: number;
  prediction_id: string;
  rated?: "accurate" | "wrong" | null;
}

export interface AnalyticsOverview {
  total_cases: number;
  cases_by_status: Record<string, number>;
  cases_by_line_of_business: Record<string, number>;
  average_fraud_score: number | null;
  avg_fraud_score?: number | null;
  current_champion_model: string | null;
  auto_approved?: number;
  auto_rejected?: number;
  in_review?: number;
  approved?: number;
  declined?: number;
  auto_decision_rate?: number | null;
  avg_processing_time_minutes?: number | null;
  estimated_fraud_savings_kes?: number | null;
  sla_compliance_rate?: number | null;
}

export interface DataQualityEvent {
  id: string;
  case_id: string | null;
  field_name: string;
  issue_type: string;
  decision: "trusted" | "corrected" | "rejected";
  created_at: string;
}

export interface QualitySummary {
  trusted: number;
  corrected: number;
  rejected: number;
  total?: number;
  recent_events?: DataQualityEvent[];
}

export interface AuditEvent {
  id?: string;
  case_id?: string;
  event_type: string;
  actor: string;
  payload: Record<string, unknown>;
  occurred_at: string;
}

export interface Investigation {
  id: string;
  case_id: string;
  investigator_id: string;
  investigator_name: string;
  status: "open" | "in_progress" | "closed" | "referred_to_ira";
  notes: string | null;
  findings: Record<string, unknown> | null;
  opened_at: string;
  closed_at: string | null;
  outcome: "fraud_confirmed" | "legitimate" | "inconclusive" | null;
}

export interface UserRecord {
  id: string;
  username: string;
  full_name: string;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}
