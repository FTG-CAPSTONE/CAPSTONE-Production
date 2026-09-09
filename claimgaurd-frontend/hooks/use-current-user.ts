"use client";

import { useState, useEffect } from "react";

export interface CurrentUser {
  name: string;
  role: string;
  username: string;
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    const token = sessionStorage.getItem("token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setUser({
          name: payload.full_name || payload.sub || "User",
          role: payload.role || "user",
          username: payload.sub || "",
        });
      } catch {
        // Invalid token format
        setUser(null);
      }
    }
  }, []);

  return user;
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
