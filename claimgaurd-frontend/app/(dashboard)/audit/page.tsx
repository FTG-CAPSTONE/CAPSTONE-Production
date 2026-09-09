"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SearchIcon, FilterXIcon } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { AuditEvent } from "@/lib/types";
import { AuditTimeline } from "@/components/intelligence/audit-timeline";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { Button } from "@/components/ui/button";
import { EVENT_LABELS } from "@/lib/constants";

const EVENT_TYPES = [
  "case_ingested", "etl_completed", "rules_evaluated", "ml_scored",
  "routed_to_hitl", "auto_approved", "auto_rejected",
  "case_opened", "decision_recorded", "investigation_opened",
  "document_uploaded",
];

export default function AuditPage() {
  const [caseId, setCaseId]     = useState("");
  const [actor, setActor]       = useState("");
  const [eventType, setEventType] = useState("");

  const params = Object.fromEntries(
    Object.entries({ case_id: caseId, actor, event_type: eventType })
      .filter(([, v]) => v.trim() !== ""),
  );

  const { data, isLoading } = useQuery<AuditEvent[]>({
    queryKey: ["audit", params],
    queryFn: async () =>
      (await apiClient.get<AuditEvent[]>("/api/audit", { params })).data,
  });

  const hasFilters = !!(caseId || actor || eventType);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Audit Trail</h1>
        <span className="text-xs text-muted-foreground">
          {data?.length ?? 0} events
        </span>
      </div>
      <p className="text-sm text-muted-foreground -mt-2">
        Immutable log of all system and reviewer actions.
      </p>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input
            className="h-8 rounded-lg border border-input bg-background pl-8 pr-3 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Case ID…"
            value={caseId}
            onChange={(e) => setCaseId(e.target.value)}
          />
        </div>
        <input
          className="h-8 rounded-lg border border-input bg-background px-3 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Actor…"
          value={actor}
          onChange={(e) => setActor(e.target.value)}
        />
        <select
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All event types</option>
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>{EVENT_LABELS[t] ?? t.replace(/_/g, " ")}</option>
          ))}
        </select>
        {hasFilters && (
          <Button
            variant="ghost" size="sm"
            onClick={() => { setCaseId(""); setActor(""); setEventType(""); }}
          >
            <FilterXIcon className="size-3.5 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Timeline */}
      {isLoading ? (
        <TableSkeleton rows={6} cols={3} />
      ) : (
        <div className="rounded-xl border border-border bg-card p-5">
          <AuditTimeline events={data ?? []} />
        </div>
      )}
    </div>
  );
}
