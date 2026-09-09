"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { EVENT_LABELS } from "@/lib/constants";
import type { AuditEvent, CaseEvent } from "@/lib/types";

type AnyEvent = AuditEvent | CaseEvent;

function EventItem({ event }: { event: AnyEvent }) {
  const [expanded, setExpanded] = useState(false);
  const isSystem = !event.actor || event.actor === "system";
  const label = EVENT_LABELS[event.event_type] ?? event.event_type.replace(/_/g, " ");
  const hasPayload = event.payload && Object.keys(event.payload).length > 0;

  let relTime = "";
  try {
    relTime = formatDistanceToNow(new Date(event.occurred_at), { addSuffix: true });
  } catch {
    relTime = event.occurred_at;
  }

  return (
    <li className="flex gap-3">
      {/* Timeline dot */}
      <div className="flex flex-col items-center">
        <div className={cn(
          "mt-1 size-2.5 rounded-full ring-2 ring-background shrink-0",
          isSystem ? "bg-muted-foreground/40" : "bg-primary",
        )} />
        <div className="w-px flex-1 bg-border mt-1" />
      </div>

      {/* Content */}
      <div className="pb-4 min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="text-sm font-medium capitalize">{label}</span>
            {" "}
            <span className={cn(
              "text-xs font-medium px-1.5 py-0.5 rounded",
              isSystem
                ? "bg-muted text-muted-foreground"
                : "bg-primary/10 text-primary",
            )}>
              {event.actor ?? "system"}
            </span>
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">{relTime}</span>
        </div>

        {hasPayload && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? (
              <ChevronDownIcon className="size-3" />
            ) : (
              <ChevronRightIcon className="size-3" />
            )}
            {expanded ? "Hide" : "Show"} details
          </button>
        )}

        {expanded && hasPayload && (
          <pre className="mt-2 overflow-x-auto rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            {JSON.stringify(event.payload, null, 2)}
          </pre>
        )}
      </div>
    </li>
  );
}

export function AuditTimeline({ events }: { events: AnyEvent[] }) {
  if (!events.length) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No audit events yet.
      </p>
    );
  }

  const sorted = [...events].sort(
    (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
  );

  return (
    <ul className="space-y-0">
      {sorted.map((e, i) => (
        <EventItem key={(e as AuditEvent).id ?? i} event={e} />
      ))}
    </ul>
  );
}
