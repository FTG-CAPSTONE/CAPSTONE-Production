"use client";

import { useRouter } from "next/navigation";
import { clearToken } from "@/lib/api-client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  UserIcon, ShieldIcon, BellIcon, SunMoonIcon, LogOutIcon,
} from "lucide-react";
import { useTheme } from "next-themes";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

function ReadInput({ value }: { value: string }) {
  return (
    <input
      readOnly
      value={value}
      className="h-9 w-full rounded-lg border border-input bg-muted/50 px-3 text-sm text-muted-foreground cursor-not-allowed"
    />
  );
}

function NotificationRow({ label, desc }: { label: string; desc: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-border last:border-0">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch />
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <Tabs defaultValue="profile" className="max-w-2xl">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="profile">
            <UserIcon className="size-3.5 mr-1.5" />Profile
          </TabsTrigger>
          <TabsTrigger value="security">
            <ShieldIcon className="size-3.5 mr-1.5" />Security
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <BellIcon className="size-3.5 mr-1.5" />Notifications
          </TabsTrigger>
          <TabsTrigger value="appearance">
            <SunMoonIcon className="size-3.5 mr-1.5" />Appearance
          </TabsTrigger>
          <TabsTrigger value="session">
            <LogOutIcon className="size-3.5 mr-1.5" />Session
          </TabsTrigger>
        </TabsList>

        {/* ── Profile ── */}
        <TabsContent value="profile" className="mt-4">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
              Account Information
            </p>
            <Field label="Display Name">
              <ReadInput value="ClaimGuard User" />
            </Field>
            <Field label="Email">
              <ReadInput value="admin@claimguard.co.ke" />
            </Field>
            <Field label="Role">
              <ReadInput value="Admin" />
            </Field>
            <p className="text-xs text-muted-foreground">
              Profile editing will be available once the user management API is connected.
            </p>
          </div>
        </TabsContent>

        {/* ── Security ── */}
        <TabsContent value="security" className="mt-4 space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
              Change Password
            </p>
            <Field label="Current Password">
              <input type="password" className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="••••••••" />
            </Field>
            <Field label="New Password">
              <input type="password" className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="••••••••" />
            </Field>
            <Field label="Confirm New Password">
              <input type="password" className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="••••••••" />
            </Field>
            <Button size="sm">Update Password</Button>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-3">
              Session Tokens
            </p>
            <p className="text-sm text-muted-foreground">
              Access tokens expire after 15 minutes. Your session will renew automatically while you are active.
            </p>
          </div>
        </TabsContent>

        {/* ── Notifications ── */}
        <TabsContent value="notifications" className="mt-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-1">
              Email Alerts
            </p>
            <NotificationRow
              label="High-risk case flagged"
              desc="When a case scores Critical and routes to your queue"
            />
            <NotificationRow
              label="Decision recorded"
              desc="Confirmation email when you approve or decline a case"
            />
            <NotificationRow
              label="Queue backlog alert"
              desc="When the HITL queue exceeds 50 pending items"
            />
            <NotificationRow
              label="Model retrain completed"
              desc="When a challenger model finishes training"
            />
            <NotificationRow
              label="SLA warning"
              desc="Cases approaching the 90-day statutory deadline"
            />
          </div>
        </TabsContent>

        {/* ── Appearance ── */}
        <TabsContent value="appearance" className="mt-4">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
              Theme
            </p>
            <div className="grid grid-cols-3 gap-3">
              {(["light", "dark", "system"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`rounded-lg border px-4 py-3 text-sm font-medium capitalize transition-all ${
                    theme === t
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              "System" follows your OS dark/light mode preference.
            </p>
          </div>
        </TabsContent>

        {/* ── Session ── */}
        <TabsContent value="session" className="mt-4 space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-3">
              Current Session
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              You are signed in as <strong>admin@claimguard.co.ke</strong>.
              Tokens are stored in session storage and expire after 15 minutes of inactivity.
            </p>
            <Separator className="my-4" />
            <p className="text-xs uppercase tracking-wide text-destructive font-medium mb-3">
              Sign Out
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Signing out clears your local session token immediately.
            </p>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                clearToken();
                router.push("/login");
              }}
            >
              <LogOutIcon className="size-3.5 mr-1.5" />
              Sign out
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
