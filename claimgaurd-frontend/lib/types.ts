/**
 * ClaimGuard frontend types — aligned to the actual backend response shapes.
 * Verified against /openapi.json on 2026-09-06.
 * Field names match the Python Pydantic schemas exactly.
 */

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface UserOut {
  id: string;
  username: string;
  full_name: string | null;
  email: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
}

// ── Cases ─────────────────────────────────────────────────────────────────────

export type CaseStatus =
  | "received"
  | "processing"
  | "in_review"
  | "auto_approved"
  | "auto_rejected"
  | "approved"
  | "declined"
  | "closed";

export type FraudBand = "low" | "medium" | "high" | "critical";

/** Returned by GET /api/cases (list) */
export interface CaseSummary {
  id: string;
  external_claim_id: string | null;
  case_type: string;
  line_of_business: string;
  claim_type: string | null;
  amount_claimed: string | null;      // Decimal serialised as string
  status: CaseStatus;
  fraud_score: string | null;
  fraud_band: FraudBand | null;
  complexity_score: string | null;
  confidence: string | null;
  submitted_at: string;
}

export interface PolicySummary {
  id: string;
  external_id: string | null;
  product_line: string;
  motor_class: string | null;
  sum_insured: string | null;
  start_date: string;
  end_date: string;
  status: string;
}

export interface PartySummary {
  id: string;
  full_name: string;
  id_number: string | null;
  phone: string | null;
  county: string | null;
}

export interface DocumentOut {
  id: string;
  doc_type: string;
  original_filename: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  uploaded_at: string;
}

export interface RuleEvaluation {
  rule_code: string;
  result: "pass" | "soft_flag" | "hard_fail";
  severity: string | null;
  description: string | null;
  triggered_value: Record<string, unknown> | null;
}

export interface AuditEvent {
  id: string;
  case_id: string;
  event_type: string;
  actor: string | null;
  payload: Record<string, unknown> | null;
  occurred_at: string;
}

/** Returned by GET /api/cases/{case_id} */
export interface CaseDetail {
  id: string;
  external_claim_id: string | null;
  case_type: string;
  line_of_business: string;
  claim_type: string | null;
  amount_claimed: string | null;
  amount_approved: string | null;
  currency: string;
  incident_date: string | null;
  reported_date: string | null;
  status: CaseStatus;
  fraud_score: string | null;
  risk_score: string | null;
  fraud_band: FraudBand | null;
  complexity_score: string | null;
  confidence: string | null;
  segment_data: Record<string, unknown> | null;
  notes: string | null;
  submitted_at: string;
  closed_at: string | null;
  policy: PolicySummary | null;
  claimant: PartySummary | null;
  provider: PartySummary | null;
  documents: DocumentOut[];
  rule_evaluations: RuleEvaluation[];
  audit_events: AuditEvent[];
}

// ── ML ────────────────────────────────────────────────────────────────────────

export interface ShapFeature {
  feature?: string;
  impact?: number;
  raw_shap?: number;
  value?: number;
  direction?: string;
  note?: string;
}

/** Returned by GET /api/ml/predictions/{case_id} */
export interface MLPrediction {
  id: string;
  case_id: string;
  model_family: string | null;
  score: string | null;
  band: FraudBand | null;
  confidence: string | null;
  shap_values: ShapFeature[] | null;
  predicted_at: string;
  model_version: string | null;
  note: string | null;
}

export interface ModelRegistryEntry {
  id: string;
  model_family: string;
  version: string;
  algorithm: string | null;
  status: "challenger" | "champion" | "rejected" | "archived";
  precision: string | null;
  recall: string | null;
  f1_score: string | null;
  auc_roc: string | null;
  false_positive_rate: string | null;
  trained_rows: number | null;
  feature_names: string[] | null;
  promoted_at: string | null;
  created_at: string;
}

/** Returned by GET /api/ml/overview */
export interface MLOverview {
  champion: ModelRegistryEntry | null;
  challenger_pending: ModelRegistryEntry | null;
  override_rate_30d: number;
  avg_confidence: number | null;
  total_predictions: number;
  note: string | null;
}

export interface TrainingRunSummary {
  id: string;
  model_registry_id: string | null;
  status: string;
  rows_used: number | null;
  fraud_rate: string | null;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
}

// ── HITL ──────────────────────────────────────────────────────────────────────

/** Returned by GET /api/hitl/queue */
export interface ReviewQueueItem {
  id: string;
  case_id: string;
  priority_score: string | null;
  reason: string | null;
  assigned_to: string | null;
  assigned_username: string | null;
  status: string;
  created_at: string;
  updated_at: string | null;
  claim_type: string | null;
  amount_claimed: string | null;
  fraud_score: string | null;
  fraud_band: FraudBand | null;
  complexity_score: string | null;
}

/** Returned by GET /api/hitl/investigations */
export interface Investigation {
  id: string;
  case_id: string;
  investigator_id: string | null;
  investigator_name: string | null;
  status: string;
  notes: string | null;
  findings: string | null;
  opened_at: string;
  closed_at: string | null;
  outcome: string | null;
}

// ── Analytics ─────────────────────────────────────────────────────────────────

/** Returned by GET /api/analytics/overview */
export interface AnalyticsOverview {
  total_cases: number;
  auto_approved: number;
  auto_rejected: number;
  in_review: number;
  approved: number;
  declined: number;
  auto_decision_rate: number;
  avg_fraud_score: number | null;
  current_champion_model: string | null;
  cases_by_lob: Record<string, number>;
  cases_by_status: Record<string, number>;
  estimated_fraud_savings_kes: number;
  sla_compliance_rate: number;
  sla_at_risk: number;
  sla_breached: number;
}

// ── Quality ───────────────────────────────────────────────────────────────────

export interface DataQualityEvent {
  id: string;
  case_id: string | null;
  field_name: string | null;
  issue_type: string | null;
  raw_value: string | null;
  decision: string | null;
  created_at: string;
}

/** Returned by GET /api/quality/summary */
export interface QualitySummary {
  trusted: number;
  corrected: number;
  rejected: number;
  total: number;
  trusted_pct: number;
  recent_events: DataQualityEvent[];
}

// ── Rules ─────────────────────────────────────────────────────────────────────

export interface RuleCatalogueEntry {
  rule_code: string;
  severity: string;
  description: string | null;
  line_of_business: string | null;
}

// ── ML Performance ────────────────────────────────────────────────────────────

export interface ROCPoint {
  fpr: number;
  tpr: number;
  threshold: number;
}

export interface ConfusionMatrix {
  tp: number;
  fp: number;
  tn: number;
  fn: number;
  precision: number;
  recall: number;
  f1: number;
}

export interface MetricHistoryPoint {
  version: string;
  trained_at: string;
  status: string;
  auc_roc: number | null;
  f1_score: number | null;
  precision: number | null;
  recall: number | null;
  false_positive_rate: number | null;
  trained_rows: number | null;
}

export interface FeatureImportanceItem {
  feature: string;
  importance: number;
}

export interface MLPerformanceResponse {
  model_version: string;
  model_id: string;
  trained_rows: number | null;
  auc_roc: number | null;
  f1_score: number | null;
  precision: number | null;
  recall: number | null;
  false_positive_rate: number | null;
  roc_curve: ROCPoint[];
  confusion_matrix: ConfusionMatrix | null;
  metric_history: MetricHistoryPoint[];
  feature_importances: FeatureImportanceItem[];
}

// ── Network / Ring Detection ──────────────────────────────────────────────────

export type RiskLevel = "low" | "medium" | "high" | "critical" | "unknown";

export interface RingSummary {
  ring_id: string;
  ring_type: string;
  case_count: number;
  flagged_count: number;
  total_amount_kes: number;
  avg_fraud_score: number | null;
  risk_level: RiskLevel;
  hub_label: string;
  hub_type: string;
  case_ids: string[];
  first_seen: string | null;
  last_seen: string | null;
}

export interface RingsListResponse {
  rings: RingSummary[];
  total_rings: number;
  total_flagged_cases: number;
  critical_rings: number;
  high_rings: number;
  generated_at: string;
}

export interface NetworkNode {
  id: string;
  node_type: string;
  label: string;
  fraud_score: number | null;
  status: string | null;
  amount: number | null;
  risk_level: RiskLevel;
}

export interface NetworkEdge {
  source: string;
  target: string;
  edge_type: string;
  weight: number;
}

export interface NetworkGraphResponse {
  ring_id: string;
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  summary: RingSummary;
}
