import { ShieldCheckIcon, ClockIcon, BuildingIcon } from "lucide-react";

export default function RiskRegisterPage() {
  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">Corporate Risk Register</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Corporate workspace for risk tracking and dispute evidence packs.
        </p>
      </div>

      {/* Coming soon card */}
      <div className="rounded-xl border border-border bg-card p-8 flex flex-col items-center text-center gap-4">
        <div className="flex size-14 items-center justify-center rounded-full bg-muted">
          <ShieldCheckIcon className="size-7 text-muted-foreground" />
        </div>
        <div>
          <p className="text-lg font-semibold">Coming in Phase 2</p>
          <p className="mt-1.5 text-sm text-muted-foreground max-w-md">
            The Corporate Workspace gives corporate policyholders and parastatal clients
            a dedicated view of their claim history, risk exposure, and tools to build
            dispute evidence packs.
          </p>
        </div>
      </div>

      {/* Planned features */}
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-4">
          Planned Features
        </p>
        <div className="space-y-3">
          {[
            {
              icon: BuildingIcon,
              title: "Policy Portfolio View",
              desc: "Aggregate view of all policies under a corporate account with claim history.",
            },
            {
              icon: ShieldCheckIcon,
              title: "Risk Exposure Dashboard",
              desc: "Live risk scoring across the portfolio — identify high-exposure lines.",
            },
            {
              icon: ClockIcon,
              title: "Evidence Export Packs",
              desc: "One-click PDF export of all claim intelligence for dispute proceedings.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex gap-3 rounded-lg bg-muted/50 px-4 py-3">
              <Icon className="size-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
