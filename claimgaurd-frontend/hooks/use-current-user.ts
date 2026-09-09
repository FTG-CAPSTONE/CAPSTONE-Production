"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";

export interface CurrentUser {
  name: string;
  role: string;
  username: string;
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    const token = sessionStorage.getItem("claimguard_token");
    if (!token) return;

    // Decode JWT for immediate render (no network wait)
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      // sub = UUID, username = actual login name — use username as initial name
      setUser({
        name: payload.username || "User",
        role: payload.role || "user",
        username: payload.username || "",
      });
    } catch {
      return;
    }

    // Then fetch /api/auth/me for full_name
    apiClient
      .get<{ full_name: string | null; username: string; role: string }>("/api/auth/me")
      .then(({ data }) => {
        setUser({
          name: data.full_name || data.username || "User",
          role: data.role || "user",
          username: data.username,
        });
      })
      .catch(() => {
        // Keep the JWT-decoded values if /me fails
      });
  }, []);

  return user;
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
