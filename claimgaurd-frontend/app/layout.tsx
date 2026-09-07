import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "@/lib/query-provider";
import { NavBar } from "@/components/nav-bar";

export const metadata: Metadata = {
  title: "ClaimGuard",
  description: "Intelligent claims analytics & decision-support platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <QueryProvider>
          <NavBar />
          <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
        </QueryProvider>
      </body>
    </html>
  );
}
