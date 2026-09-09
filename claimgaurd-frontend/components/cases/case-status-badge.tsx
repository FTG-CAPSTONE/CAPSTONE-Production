import { cn } from "@/lib/utils";
import { STATUS_CLASSES, STATUS_LABELS } from "@/lib/constants";
import type { CaseStatus } from "@/lib/types";

export function CaseStatusBadge({
  status,
  className,
}: {
  status: CaseStatus | string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_CLASSES[status] ?? "bg-slate-100 text-slate-600",
        className,
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
