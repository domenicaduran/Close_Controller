import { ReactNode } from "react";

import { logoutAction } from "@/app/actions";
import { getCurrentUser } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SidebarNav } from "./sidebar-nav";

export async function AppShell({ children }: { children: ReactNode }) {
  const pathname = (await headers()).get("x-pathname");
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    if (pathname !== "/login") {
      redirect("/login");
    }
    return <div className="min-h-screen bg-[#F7F8FA]">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1920px] gap-4 px-4 py-4 2xl:max-w-none">
        <aside className="sticky top-4 flex h-[calc(100vh-2rem)] w-[17.5rem] flex-col rounded-2xl border border-slate-800 bg-slate-900 px-5 py-5 text-slate-100 shadow-[0_8px_24px_rgba(15,23,42,0.16)]">
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

          <div className="mt-8 min-h-0 flex-1 overflow-y-auto pr-1">
            <SidebarNav role={currentUser.role} />
          </div>

          <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-800/90 px-4 py-4 shadow-[0_6px_18px_rgba(15,23,42,0.18)]">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Current User</p>
            <div className="mt-3 flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-600 bg-slate-700 text-sm font-semibold text-white">
                {currentUser.name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{currentUser.name}</p>
                <p className="mt-1 truncate text-xs text-slate-300">{currentUser.email}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                  {currentUser.role} {currentUser.title ? `· ${currentUser.title}` : ""}
                </p>
              </div>
            </div>
            <form action={logoutAction} className="mt-4">
              <button
                type="submit"
                className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-950"
              >
                Sign Out
              </button>
            </form>
          </div>
        </aside>

        <main className="min-w-0 flex-1 py-1">{children}</main>
      </div>
    </div>
  );
}
