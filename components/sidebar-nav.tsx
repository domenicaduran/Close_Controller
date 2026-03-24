"use client";

import { UserRole } from "@prisma/client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/", label: "Dashboard" },
  { href: "/clients", label: "Clients" },
  { href: "/tasks", label: "Tasks" },
  { href: "/team", label: "Team", roles: [UserRole.ADMIN] },
  { href: "/templates", label: "Templates", roles: [UserRole.ADMIN, UserRole.MANAGER] },
  { href: "/periods", label: "Periods" },
  { href: "/imports", label: "Imports", roles: [UserRole.ADMIN, UserRole.MANAGER] },
  { href: "/audit-log", label: "Audit Log", roles: [UserRole.ADMIN] },
] satisfies Array<{ href: string; label: string; roles?: UserRole[] }>;

export function SidebarNav({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const visibleNavigation = navigation.filter((item) => !item.roles || item.roles.some((allowedRole) => allowedRole === role));

  return (
    <nav className="space-y-1.5">
      {visibleNavigation.map((item) => {
        const isActive =
          item.href === "/" ? pathname === item.href : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center rounded-xl border px-4 py-3 text-sm font-medium transition ${
              isActive
                ? "border-slate-600 bg-slate-800 text-white shadow-sm"
                : "border-transparent text-slate-300 hover:border-slate-800 hover:bg-slate-800/70 hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
