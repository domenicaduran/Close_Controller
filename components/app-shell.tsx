import { ReactNode } from "react";

import { prisma } from "@/lib/prisma";
import { SidebarNav } from "./sidebar-nav";

export async function AppShell({ children }: { children: ReactNode }) {
  const [clientCount, openPeriods, blockedTasks] = await Promise.all([
    prisma.client.count({ where: { isArchived: false } }),
    prisma.periodInstance.count({ where: { status: { not: "ARCHIVED" } } }),
    prisma.taskInstance.count({ where: { status: "BLOCKED" } }),
  ]);

  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1920px] gap-4 px-4 py-4 2xl:max-w-none">
        <aside className="sticky top-4 h-[calc(100vh-2rem)] w-[17.5rem] rounded-2xl border border-slate-800 bg-slate-900 px-5 py-5 text-slate-100 shadow-[0_8px_24px_rgba(15,23,42,0.16)]">
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">
              Close Controller
            </p>
            <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-white">
              Close Controller
            </h1>
            <p className="text-sm leading-6 text-slate-400">
              Local-first recurring accounting operations across clients, periods, and audit support.
            </p>
          </div>

          <SidebarNav />

          <div className="mt-8 grid gap-3">
            <StatCard label="Active Clients" value={String(clientCount)} />
            <StatCard label="Open Periods" value={String(openPeriods)} />
            <StatCard label="Blocked Tasks" value={String(blockedTasks)} />
          </div>
        </aside>

        <main className="min-w-0 flex-1 py-1">{children}</main>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-800/70 px-4 py-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-white">{value}</p>
    </div>
  );
}
