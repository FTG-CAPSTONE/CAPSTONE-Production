"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const labelMap: Record<string, string> = {
  dashboard:        "Dashboard",
  cases:            "Cases",
  hitl:             "Review Queue",
  investigations:   "Investigations",
  "ml-admin":       "ML Admin",
  "ml-performance": "Model Performance",
  network:          "Network / Rings",
  analytics:        "Analytics",
  quality:          "Data Quality",
  audit:            "Audit Trail",
  admin:            "User Management",
  settings:         "Settings",
  help:             "Help",
  "risk-register":  "Risk Register",
  unauthorized:     "Unauthorized",
};

export function DynamicBreadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {segments.map((segment, index) => {
          const href = "/" + segments.slice(0, index + 1).join("/");
          const label =
            labelMap[segment] ??
            segment.charAt(0).toUpperCase() + segment.slice(1);
          const isLast = index === segments.length - 1;

          // key must be on React.Fragment — BreadcrumbItem and BreadcrumbSeparator
          // are both <li> siblings inside the BreadcrumbList <ol>, so they can't
          // be wrapped in a plain <> without a key on the fragment itself.
          return (
            <React.Fragment key={href}>
              <BreadcrumbItem
                className={
                  !isLast && segments.length > 1 ? "hidden md:flex" : undefined
                }
              >
                {isLast ? (
                  <BreadcrumbPage>{label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink render={<Link href={href} />}>
                    {label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && (
                <BreadcrumbSeparator className="hidden md:flex" />
              )}
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
