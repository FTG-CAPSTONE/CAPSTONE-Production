"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type {
  MLPerformanceResponse,
  MetricHistoryPoint,
  ROCPoint,
  FeatureImportanceItem,
} from "@/lib/types";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  ReferenceLine,
  ScatterChart,
  Scatter,
  Area,
  AreaChart,
} from "recharts";

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(v: number | null | undefined) {
  if (v === null || v === undefined) return "—";
  return (v * 100).toFixed(1) + "%";
}

function fmtScore(v: number | null | undefined) {
  if (v === null || v === undefined) return "—";
  return v.toFixed(4);
}

function riskColor(auc: number | null | undefined) {
  const v = auc ?? 0;
  if (v >= 0.85) return "text-emerald-600";
  if (v >= 0.75) return "text-blue-600";
  if (v >= 0.65) return "text-amber-600";
  return "text-red-600";
}

// ── Metric card ───────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  subtitle,
  highlight,
}: {
  label: string;
  value: string;
  subtitle?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold tabular-nums ${
          highlight ? "text-blue-700" : "text-slate-800"
        }`}
      >
        {value}
      </p>
      {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
    </div>
  );
}

// ── Confusion matrix cell ─────────────────────────────────────────────────────

function CMCell({
  value,
  label,
  bg,
}: {
  value: number;
  label: string;
  bg: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-lg p-4 ${bg}`}>
      <span className="text-2xl font-bold tabular-nums">{value.toLocaleString()}</span>
      <span className="mt-1 text-xs font-medium text-slate-600">{label}</span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MlPerformancePage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["ml-performance"],
    queryFn: async () =>
      (await apiClient.get<MLPerformanceResponse>("/api/ml/performance")).data,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        <span className="ml-3 text-sm text-slate-500">Loading performance data…</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-sm font-medium text-red-700">
          Could not load model performance. Train and promote a model first via ML Admin Portal.
        </p>
      </div>
    );
  }

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = {
      champion: "bg-emerald-100 text-emerald-700",
      challenger: "bg-blue-100 text-blue-700",
      rejected: "bg-red-100 text-red-700",
      archived: "bg-slate-100 text-slate-500",
    };
    return colors[s] ?? "bg-slate-100 text-slate-500";
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Model Performance</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Champion:{" "}
            <span className="font-medium text-slate-700">{data.model_version}</span>
            {data.trained_rows != null && (
              <> · trained on {data.trained_rows.toLocaleString()} samples</>
            )}
          </p>
        </div>
        <a
          href="/ml-admin"
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          ← ML Admin Portal
        </a>
      </div>

      {/* Key metrics row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <MetricCard
          label="AUC-ROC"
          value={fmtScore(data.auc_roc)}
          subtitle="Area under curve"
          highlight
        />
        <MetricCard label="F1 Score" value={fmtScore(data.f1_score)} subtitle="Harmonic mean" />
        <MetricCard label="Precision" value={pct(data.precision)} subtitle="When it flags, it's right" />
        <MetricCard label="Recall" value={pct(data.recall)} subtitle="Fraud it catches" />
        <MetricCard
          label="False Positive Rate"
          value={pct(data.false_positive_rate)}
          subtitle="Clean claims flagged"
        />
      </div>

      {/* ROC Curve + Confusion Matrix side by side */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* ROC Curve */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-1 text-sm font-semibold">ROC Curve</h2>
          <p className="mb-4 text-xs text-slate-400">
            True Positive Rate vs False Positive Rate · AUC = {fmtScore(data.auc_roc)}
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data.roc_curve} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
              <defs>
                <linearGradient id="rocGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="fpr"
                type="number"
                domain={[0, 1]}
                tickFormatter={(v) => v.toFixed(1)}
                label={{ value: "FPR", position: "insideBottom", offset: -2, fontSize: 11 }}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                dataKey="tpr"
                type="number"
                domain={[0, 1]}
                tickFormatter={(v) => v.toFixed(1)}
                label={{ value: "TPR", angle: -90, position: "insideLeft", fontSize: 11 }}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(v: number) => v.toFixed(3)}
                labelFormatter={(l) => `FPR: ${Number(l).toFixed(3)}`}
              />
              {/* Random classifier diagonal */}
              <ReferenceLine
                segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
                stroke="#e2e8f0"
                strokeDasharray="4 4"
                label={{ value: "Random", fontSize: 10, fill: "#94a3b8" }}
              />
              <Area
                type="monotone"
                dataKey="tpr"
                stroke="#2563eb"
                strokeWidth={2}
                fill="url(#rocGrad)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Confusion Matrix */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-1 text-sm font-semibold">Confusion Matrix</h2>
          <p className="mb-4 text-xs text-slate-400">
            Estimated from stored metrics · based on{" "}
            {data.trained_rows?.toLocaleString() ?? "?"} samples
          </p>
          {data.confusion_matrix ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <CMCell
                  value={data.confusion_matrix.tp}
                  label="True Positive (caught fraud)"
                  bg="bg-emerald-50"
                />
                <CMCell
                  value={data.confusion_matrix.fp}
                  label="False Positive (clean flagged)"
                  bg="bg-amber-50"
                />
                <CMCell
                  value={data.confusion_matrix.fn}
                  label="False Negative (missed fraud)"
                  bg="bg-red-50"
                />
                <CMCell
                  value={data.confusion_matrix.tn}
                  label="True Negative (clean cleared)"
                  bg="bg-slate-50"
                />
              </div>
              <div className="mt-4 flex gap-4 text-xs text-slate-500">
                <span>Precision: <strong>{pct(data.confusion_matrix.precision)}</strong></span>
                <span>Recall: <strong>{pct(data.confusion_matrix.recall)}</strong></span>
                <span>F1: <strong>{data.confusion_matrix.f1.toFixed(3)}</strong></span>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-400">
              No predictions made with this model yet.
            </p>
          )}
        </div>
      </div>

      {/* Feature Importances */}
      {data.feature_importances.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-1 text-sm font-semibold">Feature Importances</h2>
          <p className="mb-4 text-xs text-slate-400">Top 15 features by model weight</p>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={[...data.feature_importances].reverse()}
              layout="vertical"
              margin={{ top: 4, right: 24, bottom: 4, left: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis
                type="number"
                domain={[0, "auto"]}
                tickFormatter={(v) => (v * 100).toFixed(1) + "%"}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                dataKey="feature"
                type="category"
                width={180}
                tick={{ fontSize: 11, fill: "#475569" }}
              />
              <Tooltip
                formatter={(v: number) => [(v * 100).toFixed(2) + "%", "Importance"]}
              />
              <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
                {data.feature_importances.map((_, i) => (
                  <Cell
                    key={i}
                    fill={i < 3 ? "#2563eb" : i < 7 ? "#60a5fa" : "#bfdbfe"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Metric history across versions */}
      {data.metric_history.length > 1 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-1 text-sm font-semibold">Metric History Across Versions</h2>
          <p className="mb-4 text-xs text-slate-400">
            AUC-ROC, F1, Precision, Recall by training version
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart
              data={data.metric_history}
              margin={{ top: 4, right: 24, bottom: 4, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="version" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 1]} tickFormatter={(v) => v.toFixed(1)} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v: number, name: string) => [v.toFixed(4), name]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="auc_roc"
                name="AUC-ROC"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="f1_score"
                name="F1"
                stroke="#16a34a"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="precision"
                name="Precision"
                stroke="#d97706"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="recall"
                name="Recall"
                stroke="#7c3aed"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>

          {/* Version status table */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-400">
                  <th className="pb-1 pr-4">Version</th>
                  <th className="pb-1 pr-4">Status</th>
                  <th className="pb-1 pr-4">AUC</th>
                  <th className="pb-1 pr-4">F1</th>
                  <th className="pb-1 pr-4">Rows</th>
                  <th className="pb-1">Trained</th>
                </tr>
              </thead>
              <tbody>
                {data.metric_history.map((m) => (
                  <tr key={m.version} className="border-t border-slate-50">
                    <td className="py-1.5 pr-4 font-medium">{m.version}</td>
                    <td className="py-1.5 pr-4">
                      <span className={`rounded px-1.5 py-0.5 ${statusBadge(m.status)}`}>
                        {m.status}
                      </span>
                    </td>
                    <td className={`py-1.5 pr-4 font-mono ${riskColor(m.auc_roc)}`}>
                      {fmtScore(m.auc_roc)}
                    </td>
                    <td className="py-1.5 pr-4 font-mono">{fmtScore(m.f1_score)}</td>
                    <td className="py-1.5 pr-4">{m.trained_rows?.toLocaleString() ?? "—"}</td>
                    <td className="py-1.5 text-slate-400">{m.trained_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data.metric_history.length <= 1 && (
        <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center">
          <p className="text-sm text-slate-400">
            Train more model versions to see the metric history trend chart.
          </p>
        </div>
      )}
    </div>
  );
}

function statusBadge(s: string) {
  const colors: Record<string, string> = {
    champion: "bg-emerald-100 text-emerald-700",
    challenger: "bg-blue-100 text-blue-700",
    rejected: "bg-red-100 text-red-700",
    archived: "bg-slate-100 text-slate-500",
  };
  return colors[s] ?? "bg-slate-100 text-slate-500";
}
