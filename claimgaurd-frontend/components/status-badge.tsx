import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CaseStatus } from "@/lib/types";

const statusConfig: Partial<Record<string, { label: string; className: string }>> = {
  received: {
    label: "Received",
    className: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
  },
  processing: {
    label: "Processing",
    className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  },
  in_review: {
    label: "In Review",
    className: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  },
  auto_approved: {
    label: "Auto Approved",
    className: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
  },
  auto_rejected: {
    label: "Auto Rejected",
    className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
  },
  approved: {
    label: "Approved",
    className: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
  },
  declined: {
    label: "Declined",
    className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
  },
  closed: {
    label: "Closed",
    className: "bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
  },
};

const legacyAliases: Partial<Record<string, { label: string; className: string }>> = {
  new:              { label: "New",       className: "bg-gray-100 text-gray-600 border-gray-200" },
  auto_rejected_rule:{ label:"Auto Rejected",className:"bg-red-100 text-red-700 border-red-200" },
  rejected:         { label: "Rejected",  className: "bg-red-100 text-red-700 border-red-200" },
  human_approve:    { label: "Approved",  className: "bg-green-100 text-green-700 border-green-200" },
  human_decline:    { label: "Declined",  className: "bg-red-100 text-red-700 border-red-200" },
  human_escalate:   { label: "Escalated", className: "bg-violet-100 text-violet-700 border-violet-200" },
};

interface StatusBadgeProps {
  status: CaseStatus | string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = (statusConfig as Record<string, { label: string; className: string }>)[status]
    ?? legacyAliases[status]
    ?? { label: status, className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" };

  return (
    <Badge
      variant="outline"
      className={cn("font-medium capitalize", config.className, className)}
    >
      {config.label}
    </Badge>
  );
}
