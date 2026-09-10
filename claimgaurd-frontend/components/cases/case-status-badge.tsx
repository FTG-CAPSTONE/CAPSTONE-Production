import { Badge } from "@/components/ui/badge";
import { STATUS_CLASSES, STATUS_LABELS } from "@/lib/constants";
import type { CaseStatus } from "@/lib/types";
export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  const label = STATUS_LABELS[status] || status;
  const className = STATUS_CLASSES[status] || "bg-gray-100 text-gray-700";
  return <Badge className={className}>{label}</Badge>;
}