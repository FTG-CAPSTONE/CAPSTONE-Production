import { cn } from "@/lib/utils";
import { InboxIcon, FilterXIcon, SearchXIcon, AlertCircleIcon } from "lucide-react";

type EmptyVariant = "queue-empty" | "filter" | "search" | "no-data" | "error";

const CONFIG: Record<EmptyVariant, { icon: React.ElementType; title: string; body: string }> = {
  "queue-empty": {
    icon: InboxIcon,
    title: "Queue is clear",
    body: "No pending items — check back later.",
  },
  filter: {
    icon: FilterXIcon,
    title: "No results",
    body: "No items match your current filters. Try adjusting or clearing them.",
  },
  search: {
    icon: SearchXIcon,
    title: "Nothing found",
    body: "Your search didn't return any results.",
  },
  "no-data": {
    icon: InboxIcon,
    title: "No data yet",
    body: "Data will appear here once records are created.",
  },
  error: {
    icon: AlertCircleIcon,
    title: "Something went wrong",
    body: "Failed to load data. Please try again.",
  },
};

export function EmptyState({
  variant = "no-data",
  title,
  body,
  className,
  action,
}: {
  variant?: EmptyVariant;
  title?: string;
  body?: string;
  className?: string;
  action?: React.ReactNode;
}) {
  const cfg = CONFIG[variant];
  const Icon = cfg.icon;
  return (
    <div className={cn(
      "flex flex-col items-center justify-center gap-3 py-16 text-center",
      className,
    )}>
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium">{title ?? cfg.title}</p>
        <p className="mt-1 text-xs text-muted-foreground max-w-xs mx-auto">
          {body ?? cfg.body}
        </p>
      </div>
      {action}
    </div>
  );
}
