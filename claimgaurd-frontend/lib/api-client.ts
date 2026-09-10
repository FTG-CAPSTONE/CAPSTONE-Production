"use client";
import axios from "axios";
const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
export const apiClient = axios.create({ baseURL: BASE_URL });
export function setToken(token: string) {
  if (typeof window !== "undefined") sessionStorage.setItem("claimguard_token", token);
}
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("claimguard_token");
}
export function clearToken() {
  if (typeof window !== "undefined") sessionStorage.removeItem("claimguard_token");
}
apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
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