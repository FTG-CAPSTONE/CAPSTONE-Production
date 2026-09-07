"use client";

import Link from "next/link";
import type { CaseSummary } from "@/lib/types";

export function CaseTable({ cases }: { cases: CaseSummary[] }) {
  if (!cases.length) {
    return <p className="p-6 text-sm text-slate-500">No cases match this filter.</p>;
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
          <th className="py-2 pr-4">Reference</th>
          <th className="py-2 pr-4">Line of business</th>
          <th className="py-2 pr-4">Amount</th>
          <th className="py-2 pr-4">Status</th>
        </tr>
      </thead>
      <tbody>
        {cases.map((c) => (
          <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
            <td className="py-2 pr-4">
              <Link href={`/cases/${c.id}`} className="font-medium text-blue-700 hover:underline">
                {c.external_ref}
              </Link>
            </td>
            <td className="py-2 pr-4 capitalize">{c.line_of_business.replace("_", " ")}</td>
            <td className="py-2 pr-4">{c.amount.toLocaleString(undefined, { style: "currency", currency: "KES" })}</td>
            <td className="py-2 pr-4">
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{c.status}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
