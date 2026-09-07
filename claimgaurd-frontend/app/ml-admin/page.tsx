"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { MLOverview, ModelRegistryEntry, TrainingRunSummary } from "@/lib/types";

function MetricRow({ model }: { model: ModelRegistryEntry }) {
  return (
    <tr className="border-b border-slate-100">
      <td className="py-2 pr-4 font-medium">{model.version}</td>
      <td className="py-2 pr-4">{model.algorithm}</td>
      <td className="py-2 pr-4">{model.precision ?? "—"}</td>
      <td className="py-2 pr-4">{model.recall ?? "—"}</td>
      <td className="py-2 pr-4">{model.f1_score ?? "—"}</td>
      <td className="py-2 pr-4">{model.auc_roc ?? "—"}</td>
      <td className="py-2 pr-4">
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{model.status}</span>
      </td>
    </tr>
  );
}

export default function MlAdminPage() {
  const queryClient = useQueryClient();

  const { data: overview } = useQuery({
    queryKey: ["ml-overview"],
    queryFn: async () => (await apiClient.get<MLOverview>("/api/ml/overview")).data,
  });
  const { data: registry } = useQuery({
    queryKey: ["ml-registry"],
    queryFn: async () => (await apiClient.get<ModelRegistryEntry[]>("/api/ml/model-registry")).data,
  });
  const { data: runs } = useQuery({
    queryKey: ["ml-runs"],
    queryFn: async () => (await apiClient.get<TrainingRunSummary[]>("/api/ml/training-runs")).data,
  });

  const retrain = useMutation({
    mutationFn: async () => apiClient.post("/api/ml/retrain"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ml-registry"] });
      queryClient.invalidateQueries({ queryKey: ["ml-runs"] });
    },
  });

  const promote = useMutation({
    mutationFn: async (id: string) => apiClient.patch(`/api/ml/model-registry/${id}/promote`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ml-overview"] });
      queryClient.invalidateQueries({ queryKey: ["ml-registry"] });
    },
  });

  const reject = useMutation({
    mutationFn: async (id: string) => apiClient.patch(`/api/ml/model-registry/${id}/reject`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ml-registry"] }),
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">ML Admin Portal</h1>
        <button
          onClick={() => retrain.mutate()}
          disabled={retrain.isPending}
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {retrain.isPending ? "Training..." : "Retrain now"}
        </button>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-slate-500">Overview</h2>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          {overview?.champion ? (
            <p className="text-sm">
              Current champion: <span className="font-semibold">{overview.champion.version}</span> (F1{" "}
              {overview.champion.f1_score})
            </p>
          ) : (
            <p className="text-sm text-amber-700">
              ⚠ No champion model is registered. All cases route to human review until one is approved.
            </p>
          )}
          {!!overview?.challengers_awaiting_review.length && (
            <p className="mt-1 text-sm text-blue-700">
              {overview.challengers_awaiting_review.length} challenger(s) awaiting your review below.
            </p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-slate-500">Model Registry — Compare &amp; Approve</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500">
                <th className="py-2 pr-4">Version</th>
                <th className="py-2 pr-4">Algorithm</th>
                <th className="py-2 pr-4">Precision</th>
                <th className="py-2 pr-4">Recall</th>
                <th className="py-2 pr-4">F1</th>
                <th className="py-2 pr-4">AUC</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {(registry ?? []).map((m) => (
                <tr key={m.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4 font-medium">{m.version}</td>
                  <td className="py-2 pr-4">{m.algorithm}</td>
                  <td className="py-2 pr-4">{m.precision ?? "—"}</td>
                  <td className="py-2 pr-4">{m.recall ?? "—"}</td>
                  <td className="py-2 pr-4">{m.f1_score ?? "—"}</td>
                  <td className="py-2 pr-4">{m.auc_roc ?? "—"}</td>
                  <td className="py-2 pr-4">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{m.status}</span>
                  </td>
                  <td className="py-2 pr-4">
                    {m.status === "challenger" && (
                      <div className="flex gap-2">
                        <button onClick={() => promote.mutate(m.id)} className="text-xs font-medium text-emerald-700 hover:underline">
                          Approve &amp; Promote
                        </button>
                        <button onClick={() => reject.mutate(m.id)} className="text-xs font-medium text-red-700 hover:underline">
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-slate-500">Training Runs</h2>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <ul className="space-y-2 text-sm">
            {(runs ?? []).map((r) => (
              <li key={r.id} className="flex justify-between">
                <span>
                  {r.status} · {r.rows_used} rows
                </span>
                <span className="text-slate-500">{JSON.stringify(r.metrics)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
