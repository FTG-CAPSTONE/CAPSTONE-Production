"use client";

import axios from "axios";

// All /api/* requests are proxied to the backend via next.config.ts rewrites.
// In development without the proxy (direct backend), set NEXT_PUBLIC_API_BASE_URL.
const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export const apiClient = axios.create({ baseURL: BASE_URL });

/** Token is kept in memory + sessionStorage for this scaffold. A production
 * build should proxy auth through a Next.js route handler and use an
 * httpOnly cookie instead — see the security note in ClaimGuard_Backend
 * _Architecture_Plan.md. This is a deliberate MVP simplification, not the
 * final security posture. */
export function setToken(token: string) {
  if (typeof window !== "undefined") {
    sessionStorage.setItem("claimguard_token", token);
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("claimguard_token");
}

export function clearToken() {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem("claimguard_token");
    document.cookie = "cg_session=; path=/; max-age=0; SameSite=Strict";
  }
}

apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      clearToken();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);
