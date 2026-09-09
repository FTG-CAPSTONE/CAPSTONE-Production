import { FileQuestion, Search, Filter, Inbox, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "no-data" | "search" | "filter" | "error";

const variants: Record<
  Variant,
  { icon: typeof Inbox; title: string; description: string }
> = {
  "no-data": {
    icon: Inbox,
    title: "No data yet",
    description: "There's nothing to show here yet.",
  },
  search: {
    icon: Search,
    title: "No results found",
    description: "Try adjusting your search terms.",
  },
  filter: {
    icon: Filter,
    title: "No matches",
    description: "Try changing or clearing your filters.",
  },
  error: {
    icon: AlertCircle,
    title: "Something went wrong",
    description: "We couldn't load this data. Please try again.",
  },
};

interface EmptyStateProps {
  variant?: Variant;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  variant = "no-data",
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const config = variants[variant];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 text-center",
        className
      )}
    >
      <div className="rounded-full bg-muted p-3">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-sm font-medium">{title ?? config.title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {description ?? config.description}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
