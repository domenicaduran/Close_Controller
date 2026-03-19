"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/", label: "Dashboard" },
  { href: "/clients", label: "Clients" },
  { href: "/tasks", label: "Tasks" },
  { href: "/templates", label: "Templates" },
  { href: "/periods", label: "Periods" },
  { href: "/imports", label: "Imports" },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="mt-8 space-y-1.5">
      {navigation.map((item) => {
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
