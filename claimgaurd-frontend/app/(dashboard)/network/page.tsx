"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { RingsListResponse, RingSummary, NetworkGraphResponse, RiskLevel } from "@/lib/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function riskBadge(level: RiskLevel) {
  const map: Record<RiskLevel, string> = {
    critical: "bg-red-100 text-red-700 border border-red-200",
    high:     "bg-orange-100 text-orange-700 border border-orange-200",
    medium:   "bg-amber-100 text-amber-700 border border-amber-200",
    low:      "bg-emerald-100 text-emerald-700 border border-emerald-200",
    unknown:  "bg-slate-100 text-slate-500",
  };
  return map[level] ?? map.unknown;
}

function riskDot(level: RiskLevel) {
  const map: Record<RiskLevel, string> = {
    critical: "bg-red-500",
    high:     "bg-orange-500",
    medium:   "bg-amber-400",
    low:      "bg-emerald-500",
    unknown:  "bg-slate-300",
  };
  return map[level] ?? map.unknown;
}

function ringTypeLabel(t: string) {
  const map: Record<string, string> = {
    provider_ring: "Provider Ring",
    claimant_ring: "Claimant Ring",
    vehicle_ring: "Vehicle Ring",
    mixed: "Mixed Ring",
  };
  return map[t] ?? t;
}

function formatKES(amount: number) {
  if (amount >= 1_000_000) return `KES ${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `KES ${(amount / 1_000).toFixed(0)}K`;
  return `KES ${amount.toFixed(0)}`;
}

// ── Summary stat card ─────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold tabular-nums ${color ?? "text-slate-800"}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

// ── Ring card ─────────────────────────────────────────────────────────────────

function RingCard({
  ring,
  onSelect,
  selected,
}: {
  ring: RingSummary;
  onSelect: (id: string) => void;
  selected: boolean;
}) {
  return (
    <button
      onClick={() => onSelect(ring.ring_id)}
      className={`w-full rounded-xl border text-left transition-all ${
        selected
          ? "border-blue-400 bg-blue-50 shadow-md"
          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
      }`}
    >
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full ${riskDot(ring.risk_level)}`} />
            <span className="truncate text-sm font-semibold text-slate-800">{ring.hub_label}</span>
          </div>
          <span className={`flex-shrink-0 rounded px-2 py-0.5 text-xs font-medium ${riskBadge(ring.risk_level)}`}>
            {ring.risk_level.toUpperCase()}
          </span>
        </div>

        {/* Ring type */}
        <p className="mt-1 pl-5 text-xs text-slate-500">{ringTypeLabel(ring.ring_type)}</p>

        {/* Stats row */}
        <div className="mt-3 grid grid-cols-3 gap-2 pl-1">
          <div>
            <p className="text-xs text-slate-400">Cases</p>
            <p className="text-sm font-bold text-slate-800">
              {ring.case_count}
              <span className="ml-1 text-red-600">({ring.flagged_count} ⚑)</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Total Exposure</p>
            <p className="text-sm font-bold text-slate-800">{formatKES(ring.total_amount_kes)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Avg Score</p>
            <p className="text-sm font-bold text-slate-800">
              {ring.avg_fraud_score != null ? ring.avg_fraud_score.toFixed(2) : "—"}
            </p>
          </div>
        </div>

        {/* Date range */}
        {(ring.first_seen || ring.last_seen) && (
          <p className="mt-2 pl-1 text-xs text-slate-400">
            {ring.first_seen} → {ring.last_seen}
          </p>
        )}
      </div>
    </button>
  );
}

// ── Graph panel ───────────────────────────────────────────────────────────────

function GraphPanel({ ringId }: { ringId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["ring-graph", ringId],
    queryFn: async () =>
      (await apiClient.get<NetworkGraphResponse>(`/api/network/rings/${ringId}`)).data,
  });

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }
  if (!data) return null;

  const nodeColorMap: Record<string, string> = {
    case:    "bg-blue-100 border border-blue-300 text-blue-800",
    party:   "bg-purple-100 border border-purple-300 text-purple-800",
    vehicle: "bg-amber-100 border border-amber-300 text-amber-800",
    policy:  "bg-slate-100 border border-slate-300 text-slate-700",
  };

  const caseNodes = data.nodes.filter((n) => n.node_type === "case");
  const hubNodes = data.nodes.filter((n) => n.node_type !== "case");

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid grid-cols-4 gap-3 text-center">
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-lg font-bold">{data.summary.case_count}</p>
          <p className="text-xs text-slate-500">Cases</p>
        </div>
        <div className="rounded-lg bg-red-50 p-3">
          <p className="text-lg font-bold text-red-700">{data.summary.flagged_count}</p>
          <p className="text-xs text-slate-500">Flagged</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-lg font-bold">{formatKES(data.summary.total_amount_kes)}</p>
          <p className="text-xs text-slate-500">Exposure</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-lg font-bold">
            {data.summary.avg_fraud_score?.toFixed(2) ?? "—"}
          </p>
          <p className="text-xs text-slate-500">Avg Score</p>
        </div>
      </div>

      {/* Hub nodes */}
      {hubNodes.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Shared Entity
          </p>
          <div className="flex flex-wrap gap-2">
            {hubNodes.map((n) => (
              <span
                key={n.id}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  nodeColorMap[n.node_type] ?? "bg-slate-100 text-slate-700"
                }`}
              >
                {n.node_type === "vehicle" ? "🚗" : n.node_type === "party" ? "👤" : "📋"}{" "}
                {n.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Case nodes */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          Connected Cases ({caseNodes.length})
        </p>
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {caseNodes.map((n) => {
            const riskColors: Record<string, string> = {
              critical: "border-l-red-500",
              high:     "border-l-orange-500",
              medium:   "border-l-amber-400",
              low:      "border-l-emerald-500",
              unknown:  "border-l-slate-300",
            };
            return (
              <div
                key={n.id}
                className={`rounded-lg border border-slate-200 border-l-4 bg-white p-3 ${
                  riskColors[n.risk_level] ?? riskColors.unknown
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-700">{n.label}</span>
                  <span className={`rounded px-1.5 py-0.5 text-xs ${riskBadge(n.risk_level as RiskLevel)}`}>
                    {n.risk_level}
                  </span>
                </div>
                {n.status && (
                  <p className="mt-0.5 text-xs text-slate-400">Status: {n.status}</p>
                )}
                {n.fraud_score != null && (
                  <p className="text-xs text-slate-400">
                    Fraud score: <span className="font-mono font-medium">{n.fraud_score.toFixed(2)}</span>
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* View individual cases link */}
      <div className="pt-2 text-center">
        <a
          href={`/cases?ids=${data.summary.case_ids.join(",")}`}
          className="text-xs font-medium text-blue-600 hover:underline"
        >
          View all {data.summary.case_count} cases in the case list →
        </a>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function NetworkRingsPage() {
  const [selectedRingId, setSelectedRingId] = useState<string | null>(null);
  const [days, setDays] = useState(90);
  const [riskFilter, setRiskFilter] = useState<string>("all");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["network-rings", days],
    queryFn: async () =>
      (await apiClient.get<RingsListResponse>(`/api/network/rings?days=${days}`)).data,
  });

  const rings = data?.rings ?? [];
  const filtered =
    riskFilter === "all"
      ? rings
      : rings.filter((r) => r.risk_level === riskFilter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Network & Ring Detection</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Clusters of claims sharing providers, claimants, or vehicles — a key fraud signal
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          ↺ Refresh
        </button>
      </div>

      {/* Stats bar */}
      {data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total Rings" value={data.total_rings} sub={`Last ${days} days`} />
          <StatCard
            label="Critical Rings"
            value={data.critical_rings}
            sub="Highest risk"
            color="text-red-600"
          />
          <StatCard
            label="High Risk Rings"
            value={data.high_rings}
            sub="Needs review"
            color="text-orange-600"
          />
          <StatCard
            label="Flagged Cases"
            value={data.total_flagged_cases}
            sub="Across all rings"
            color="text-amber-600"
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500">Window</label>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
            <option value={180}>180 days</option>
            <option value={365}>1 year</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500">Risk</label>
          <div className="flex gap-1">
            {["all", "critical", "high", "medium", "low"].map((r) => (
              <button
                key={r}
                onClick={() => setRiskFilter(r)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  riskFilter === r
                    ? "bg-blue-600 text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <span className="ml-3 text-sm text-slate-500">Analysing network patterns…</span>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-700">Failed to load network data. Is the backend running?</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center">
          <p className="text-2xl">🕸️</p>
          <p className="mt-2 text-sm font-medium text-slate-600">No rings detected</p>
          <p className="mt-1 text-xs text-slate-400">
            {riskFilter !== "all"
              ? "Try a different risk filter"
              : "No claim clusters found in the selected window. Seed more data or widen the window."}
          </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Ring list — left panel */}
          <div className="space-y-3 lg:col-span-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {filtered.length} ring{filtered.length !== 1 ? "s" : ""} found
            </p>
            {filtered.map((ring) => (
              <RingCard
                key={ring.ring_id}
                ring={ring}
                selected={selectedRingId === ring.ring_id}
                onSelect={setSelectedRingId}
              />
            ))}
          </div>

          {/* Graph detail — right panel */}
          <div className="lg:col-span-3">
            {selectedRingId ? (
              <div className="sticky top-4 rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="mb-4 text-sm font-semibold">
                  Ring Detail —{" "}
                  <span className="font-mono text-blue-600">
                    {selectedRingId.split("-").slice(1, 3).join("-")}…
                  </span>
                </h2>
                <GraphPanel ringId={selectedRingId} />
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50">
                <div className="text-center">
                  <p className="text-3xl">←</p>
                  <p className="mt-2 text-sm text-slate-500">Select a ring to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
