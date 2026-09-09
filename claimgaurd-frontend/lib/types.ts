/**
 * ClaimGuard — authoritative frontend type definitions.
 * Merged from both branches. Field names match the Python Pydantic schemas
 * as verified against /openapi.json (2026-09-09).
 *
 * Backwards-compat aliases kept so existing pages don't break:
 *   external_ref → external_claim_id  (CaseSummary / CaseDetail)
 *   amount       → amount_claimed     (serialised as string from Decimal)
 *   predictions  → use GET /api/ml/predictions/{case_id} (MLPrediction)
 */

// ── Auth ──────────────────────────────────────────────────────────────────────

export type Role =
  | "admin" | "underwriter" | "adjuster" | "investigator"
  | "ml_admin" | "compliance" | "corporate_risk" | "viewer";

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

/** Alias kept for existing code using CurrentUser */
export type CurrentUser = UserOut & { role: Role };

// ── Cases ─────────────────────────────────────────────────────────────────────

export type CaseStatus =
  | "received" | "processing" | "in_review"
  | "auto_approved" | "auto_rejected"
  | "approved" | "declined" | "closed"
  // legacy backend values — kept for backwards compat
  | "new" | "auto_rejected_rule" | "rejected"
  | "human_approve" | "human_decline" | "human_escalate";

export type FraudBand = "low" | "medium" | "high" | "critical";
/** Alias kept for existing components using RiskBand */
export type RiskBand = "Low" | "Medium" | "High" | "Critical";

/** Returned by GET /api/cases (list) */
export interface CaseSummary {
  id: string;
  // Primary field name from backend
  external_claim_id: string | null;
  // Backwards-compat alias — populated from external_claim_id by API layer
  external_ref?: string | null;
  case_type: string;
  line_of_business: string;
  claim_type: string | null;
  // Backend returns Decimal as string
  amount_claimed: string | null;
  /** Backwards-compat numeric alias — use parseFloat(amount_claimed) */
  amount?: number;
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
  /** Signed download URL — populated by the cases detail endpoint */
  download_url?: string;
}
/** Alias for existing pages using Document */
export type Document = DocumentOut;

export interface RuleEvaluation {
  rule_code: string;
  result: "pass" | "soft_flag" | "hard_fail";
  /** Backwards-compat alias */
  passed?: "pass" | "fail" | "soft_flag";
  severity: string | null;
  description: string | null;
  /** Backwards-compat alias */
  message?: string;
  triggered_value: Record<string, unknown> | null;
}
/** Alias for existing components using RuleResult */
export type RuleResult = RuleEvaluation;

export interface AuditEvent {
  id?: string;
  case_id?: string;
  event_type: string;
  actor: string | null;
  payload: Record<string, unknown> | null;
  occurred_at: string;
}
/** Alias for existing components using CaseEvent */
export type CaseEvent = AuditEvent;

/** Returned by GET /api/cases/{case_id} */
export interface CaseDetail {
  id: string;
  external_claim_id: string | null;
  /** Backwards-compat alias */
  external_ref?: string | null;
  case_type: string;
  line_of_business: string;
  claim_type: string | null;
  amount_claimed: string | null;
  /** Backwards-compat numeric alias */
  amount?: number;
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
  /** Backwards-compat alias for segment_data */
  feature_snapshot?: Record<string, unknown>;
  notes: string | null;
  submitted_at: string;
  closed_at: string | null;
  policy: PolicySummary | null;
  claimant: PartySummary | null;
  provider: PartySummary | null;
  documents: DocumentOut[];
  rule_evaluations: RuleEvaluation[];
  /** Backwards-compat alias */
  rules?: RuleEvaluation[];
  audit_events: AuditEvent[];
  /** Legacy: predictions array from old endpoint */
  predictions?: MLPredictionSummary[];
  queue_item?: ReviewQueueItem | null;
  latest_decision?: ReviewDecision | null;
}

// ── ML ────────────────────────────────────────────────────────────────────────

export interface ShapFeature {
  feature?: string;
  impact?: number;
  raw_shap?: number;
  value?: number | string;
  direction?: "increases_risk" | "decreases_risk" | string;
  note?: string;
}

/** Legacy summary shape from old /api/cases/{id} predictions array */
export interface MLPredictionSummary {
  score: number;
  band: RiskBand | FraudBand;
  confidence: number | null;
  top_features: ShapFeature[];
  model_version?: string;
  predicted_at?: string;
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
  status: "challenger" | "champion" | "rejected" | "retired" | "archived";
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
  challengers_awaiting_review?: ModelRegistryEntry[];
  challenger_pending?: ModelRegistryEntry | null;
  override_rate_30d: number;
  avg_confidence?: number | null;
  avg_confidence_hitl?: number | null;
  total_predictions?: number;
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
  metrics?: Record<string, number | null>;
}

export interface MLFeedbackItem {
  id: string;
  case_id: string;
  score: number;
  confidence: number;
  prediction_id: string;
  rated?: "accurate" | "wrong" | null;
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

export interface ReviewDecision {
  id: string;
  case_id: string;
  reviewer_id: string;
  reviewer_name: string;
  decision: "approved" | "declined" | "escalated" | "request_docs";
  rationale: string;
  decided_at: string;
}

/** Returned by GET /api/hitl/investigations */
export interface Investigation {
  id: string;
  case_id: string;
  investigator_id: string | null;
  investigator_name: string | null;
  status: "open" | "in_progress" | "closed" | "referred_to_ira" | string;
  notes: string | null;
  findings: string | null;
  opened_at: string;
  closed_at: string | null;
  outcome: "fraud_confirmed" | "legitimate" | "inconclusive" | string | null;
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
  /** Alias kept for existing dashboard page */
  average_fraud_score?: number | null;
  current_champion_model: string | null;
  cases_by_lob: Record<string, number>;
  /** Alias kept for existing analytics page */
  cases_by_line_of_business?: Record<string, number>;
  cases_by_status: Record<string, number>;
  estimated_fraud_savings_kes: number;
  sla_compliance_rate: number;
  sla_at_risk: number;
  sla_breached: number;
  avg_processing_time_minutes?: number | null;
  auto_decision_rate_value?: number | null;
}

// ── Quality ───────────────────────────────────────────────────────────────────

export interface DataQualityEvent {
  id: string;
  case_id: string | null;
  field_name: string | null;
  issue_type: string | null;
  raw_value?: string | null;
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

// ── Users ─────────────────────────────────────────────────────────────────────

export interface UserRecord {
  id: string;
  username: string;
  full_name: string;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: string;
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
