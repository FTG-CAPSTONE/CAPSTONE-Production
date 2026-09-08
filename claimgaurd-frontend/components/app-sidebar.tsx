"use client";

import * as React from "react";
import Link from "next/link";
import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  LayoutDashboardIcon,
  FolderOpenIcon,
  ClipboardListIcon,
  BrainCircuitIcon,
  BarChart3Icon,
  DatabaseZapIcon,
  ScrollTextIcon,
  ShieldCheckIcon,
  SettingsIcon,
  LifeBuoyIcon,
  SearchIcon,
  UsersIcon,
} from "lucide-react";

const data = {
  navMain: [
    { title: "Dashboard",       url: "/dashboard",       icon: <LayoutDashboardIcon /> },
    { title: "Cases",           url: "/cases",           icon: <FolderOpenIcon /> },
    { title: "Review Queue",    url: "/hitl",            icon: <ClipboardListIcon /> },
    { title: "Investigations",  url: "/investigations",  icon: <SearchIcon /> },
    { title: "ML Admin",        url: "/ml-admin",        icon: <BrainCircuitIcon /> },
    { title: "Analytics",       url: "/analytics",       icon: <BarChart3Icon /> },
    { title: "Data Quality",    url: "/quality",         icon: <DatabaseZapIcon /> },
    { title: "Audit Trail",     url: "/audit",           icon: <ScrollTextIcon /> },
  ],
  navSecondary: [
    { title: "Admin",    url: "/admin",    icon: <UsersIcon /> },
    { title: "Settings", url: "/settings", icon: <SettingsIcon /> },
    { title: "Help",     url: "/help",     icon: <LifeBuoyIcon /> },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/dashboard" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <ShieldCheckIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">ClaimGuard</span>
                <span className="truncate text-xs text-muted-foreground">
                  Claims Analytics
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain items={data.navMain} label="Navigation" />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
