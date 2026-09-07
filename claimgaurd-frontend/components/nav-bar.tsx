"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearToken } from "@/lib/api-client";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/cases", label: "Cases" },
  { href: "/hitl", label: "Review Queue" },
  { href: "/ml-admin", label: "ML Admin" },
  { href: "/analytics", label: "Analytics" },
  { href: "/quality", label: "Data Quality" },
];

export function NavBar() {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/login") return null;

  return (
    <nav className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
      <div className="flex items-center gap-6">
        <span className="text-lg font-semibold text-slate-900">ClaimGuard</span>
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`text-sm ${pathname.startsWith(l.href) ? "font-medium text-blue-700" : "text-slate-600 hover:text-slate-900"}`}
          >
            {l.label}
          </Link>
        ))}
      </div>
      <button
        onClick={() => {
          clearToken();
          router.push("/login");
        }}
        className="text-sm text-slate-500 hover:text-slate-900"
      >
        Sign out
      </button>
    </nav>
  );
}
