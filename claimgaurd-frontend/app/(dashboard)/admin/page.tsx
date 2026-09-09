"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PlusIcon, Loader2Icon } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { UserRecord, Role } from "@/lib/types";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";

const ROLES: Role[] = [
  "admin","underwriter","adjuster","investigator",
  "ml_admin","compliance","corporate_risk","viewer",
];

const ROLE_BADGES: Record<string, string> = {
  admin:          "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  underwriter:    "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  adjuster:       "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  investigator:   "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  ml_admin:       "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  compliance:     "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  corporate_risk: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  viewer:         "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

interface CreatePayload {
  username: string; full_name: string;
  email: string; role: Role; password: string;
}

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreatePayload>({
    username: "", full_name: "", email: "", role: "viewer", password: "",
  });

  const { data = [], isLoading } = useQuery<UserRecord[]>({
    queryKey: ["users"],
    queryFn: async () => (await apiClient.get<UserRecord[]>("/api/users")).data,
  });

  const createUser = useMutation({
    mutationFn: async (payload: CreatePayload) =>
      apiClient.post<UserRecord>("/api/auth/register", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User created");
      setCreateOpen(false);
      setForm({ username: "", full_name: "", email: "", role: "viewer", password: "" });
    },
    onError: () => toast.error("Failed to create user"),
  });

  const updateRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) =>
      apiClient.patch(`/api/users/${id}`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Role updated");
    },
    onError: () => toast.error("Failed to update role"),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) =>
      apiClient.patch(`/api/users/${id}`, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: () => toast.error("Failed to update status"),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">User Management</h1>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <PlusIcon className="size-3.5 mr-1.5" />
          Create User
        </Button>
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Username</TableHead>
                <TableHead>Full Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <EmptyState variant="no-data" title="No users" body="Create the first user above." />
                  </TableCell>
                </TableRow>
              )}
              {data.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium font-mono text-xs">{u.username}</TableCell>
                  <TableCell className="text-sm">{u.full_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <select
                      defaultValue={u.role}
                      onChange={(e) => updateRole.mutate({ id: u.id, role: e.target.value })}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium border-0 cursor-pointer focus:outline-none ${
                        ROLE_BADGES[u.role] ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{r.replace(/_/g, " ")}</option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={u.is_active}
                      onCheckedChange={(v) => toggleActive.mutate({ id: u.id, is_active: v })}
                    />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create user dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
            <DialogDescription>
              The user will be able to log in immediately with the provided credentials.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {(["username", "full_name", "email", "password"] as const).map((field) => (
              <div key={field}>
                <label className="mb-1.5 block text-sm font-medium capitalize">
                  {field.replace(/_/g, " ")}
                </label>
                <input
                  type={field === "password" ? "password" : "text"}
                  value={form[field]}
                  onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            ))}
            <div>
              <label className="mb-1.5 block text-sm font-medium">Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createUser.mutate(form)}
              disabled={
                !form.username || !form.email || !form.password ||
                createUser.isPending
              }
            >
              {createUser.isPending
                ? <><Loader2Icon className="size-4 animate-spin mr-1.5" />Creating…</>
                : "Create User"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
