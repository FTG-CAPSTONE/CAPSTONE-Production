import Link from "next/link";
import { ShieldOffIcon } from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
        <ShieldOffIcon className="size-7 text-red-600 dark:text-red-400" />
      </div>
      <div>
        <h1 className="text-2xl font-semibold">Access Denied</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm">
          You don&apos;t have permission to view this page.
          Contact your administrator if you believe this is a mistake.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="mt-2 inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
