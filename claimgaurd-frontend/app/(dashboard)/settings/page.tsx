"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient, clearToken } from "@/lib/api-client";

interface UserMe {
  id: string;
  username: string;
  full_name: string;
  email: string | null;
  role: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserMe | null>(null);

  // Fetch the real logged-in user on mount
  useEffect(() => {
    apiClient
      .get<UserMe>("/api/auth/me")
      .then((r) => setUser(r.data))
      .catch(() => {
        // Token invalid — clear and go to login
        clearToken();
        router.push("/login");
      });
  }, [router]);

  function handleSignOut() {
    clearToken();
    router.push("/login");
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Settings</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Manage your account and platform preferences.
      </p>

      <div className="grid gap-4 max-w-2xl">
        {/* Profile — live data from /api/auth/me */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Profile
          </h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Full name</label>
              <input
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={user?.full_name ?? "Loading…"}
                readOnly
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Username</label>
              <input
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={user?.username ?? "Loading…"}
                readOnly
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Email</label>
              <input
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={user?.email ?? "—"}
                readOnly
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Role</label>
              <input
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm capitalize focus:outline-none focus:ring-2 focus:ring-ring"
                value={user?.role ?? "Loading…"}
                readOnly
              />
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Preferences
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Theme</p>
              <p className="text-xs text-muted-foreground">
                Use the toggle in the top-right header to switch between light and dark mode.
              </p>
            </div>
          </div>
        </div>

        {/* Session — Sign out clears the token properly */}
        <div className="rounded-xl border border-destructive/30 bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-destructive">
            Session
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Signing out will clear your session token from this browser.
          </p>
          <button
            onClick={handleSignOut}
            className="inline-flex items-center rounded-lg bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/20 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
