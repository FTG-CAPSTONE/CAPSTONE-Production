"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { ChevronsUpDownIcon, LogOutIcon, UserIcon } from "lucide-react";
import { apiClient, clearToken } from "@/lib/api-client";

interface UserMe {
  full_name: string;
  username: string;
  email: string | null;
  role: string;
}

// Fallback user shown while /api/auth/me loads or when unauthenticated
const FALLBACK: UserMe = { full_name: "ClaimGuard", username: "user", email: null, role: "" };

export function NavUser() {
  const { isMobile } = useSidebar();
  const router = useRouter();
  const [user, setUser] = useState<UserMe>(FALLBACK);

  useEffect(() => {
    apiClient
      .get<UserMe>("/api/auth/me")
      .then((r) => setUser(r.data))
      .catch(() => {
        // Token gone or expired — redirect to login
        clearToken();
        router.push("/login");
      });
  }, [router]);

  function handleLogout() {
    clearToken();
    router.push("/login");
  }

  const initials = user.full_name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />
            }
          >
            <Avatar>
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user.full_name}</span>
              <span className="truncate text-xs text-muted-foreground capitalize">
                {user.role || user.email || user.username}
              </span>
            </div>
            <ChevronsUpDownIcon className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar>
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user.full_name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user.email ?? user.username}
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              <UserIcon />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOutIcon />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
