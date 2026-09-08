"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export function NavSecondary({
  items,
  className,
}: {
  items: { title: string; url: string; icon: React.ReactNode }[];
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <SidebarGroup className={cn(className)}>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton
              isActive={pathname.startsWith(item.url)}
              tooltip={item.title}
              render={<Link href={item.url} />}
              size="sm"
            >
              {item.icon}
              <span>{item.title}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
