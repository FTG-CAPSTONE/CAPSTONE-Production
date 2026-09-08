"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { UserOut } from "@/lib/types";

const ROLE_BADGE: Record<string, string> = {
  admin:      "bg-purple-100 text-purple-700",
  reviewer:   "bg-blue-100 text-blue-700",
  analyst:    "bg-teal-100 text-teal-700",
  viewer:     "bg-slate-100 text-slate-600",
};

interface CreateUserForm {
  username: string;
  full_name: string;
  email: string;
  password: string;
  role: string;
}

const EMPTY_FORM: CreateUserForm = {
  username: "",
  full_name: "",
  email: "",
  password: "",
  role: "reviewer",
};

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateUserForm>(EMPTY_FORM);
  const [formError, setFormError] = useState("");

  const { data: users, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () =>
      (await apiClient.get<UserOut[]>("/api/users")).data,
  });

  // Create user: POST /api/auth/register
  const createMutation = useMutation({
    mutationFn: async (payload: CreateUserForm) =>
      apiClient.post<UserOut>("/api/auth/register", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setForm(EMPTY_FORM);
      setShowCreate(false);
      setFormError("");
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Failed to create user.";
      setFormError(typeof msg === "string" ? msg : JSON.stringify(msg));
    },
  });

  // Toggle active: PATCH /api/users/{id}  body: { is_active: bool }
  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) =>
      apiClient.patch(`/api/users/${id}`, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">User Management</h1>
          <p className="text-sm text-slate-500">
            Manage system users, roles, and account status.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
        >
          + Add User
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last Login</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {(users ?? []).map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                >
                  <td className="px-4 py-3 font-medium">
                    {u.full_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{u.username}</td>
                  <td className="px-4 py-3 text-slate-600">{u.email ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        ROLE_BADGE[u.role] ?? "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        u.is_active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      {u.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {u.last_login_at
                      ? new Date(u.last_login_at).toLocaleDateString()
                      : "Never"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() =>
                        toggleMutation.mutate({
                          id: u.id,
                          is_active: !u.is_active,
                        })
                      }
                      className="text-xs text-blue-700 hover:underline"
                    >
                      {u.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create user modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-base font-semibold">Add New User</h2>

            <div className="space-y-3">
              {(
                [
                  { name: "full_name",  label: "Full Name",       type: "text"     },
                  { name: "username",   label: "Username",         type: "text"     },
                  { name: "email",      label: "Email",            type: "email"    },
                  { name: "password",   label: "Password",         type: "password" },
                ] as const
              ).map(({ name, label, type }) => (
                <div key={name}>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    {label}
                  </label>
                  <input
                    type={type}
                    name={name}
                    value={form[name]}
                    onChange={handleChange}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Role
                </label>
                <select
                  name="role"
                  value={form.role}
                  onChange={handleChange}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="admin">Admin</option>
                  <option value="reviewer">Reviewer</option>
                  <option value="analyst">Analyst</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
            </div>

            {formError && (
              <p className="mt-3 text-xs text-red-600">{formError}</p>
            )}

            <div className="mt-4 flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowCreate(false);
                  setForm(EMPTY_FORM);
                  setFormError("");
                }}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                disabled={
                  !form.username || !form.password || createMutation.isPending
                }
                onClick={() => createMutation.mutate(form)}
                className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 hover:bg-blue-800"
              >
                {createMutation.isPending ? "Creating…" : "Create User"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
