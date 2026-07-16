"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { User } from "@/domain/entities";
import { getNavItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function Sidebar({
  user,
  mobileOpen = false,
  onNavigate,
  developmentToolkitEnabled = false,
}: {
  user: User;
  mobileOpen?: boolean;
  onNavigate?: () => void;
  developmentToolkitEnabled?: boolean;
}) {
  const pathname = usePathname() ?? "";
  const items = getNavItems(user, { developmentToolkitEnabled });

  return (
    <aside
      className={cn(
        "z-50 flex flex-col border-r border-kengen-navy/20 bg-kengen-navy text-white",
        "fixed bottom-0 left-0 top-12 w-[min(16rem,85vw)] transform transition-transform duration-200 ease-out md:static md:h-full md:w-56 md:translate-x-0 md:self-stretch md:transition-none",
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}
    >
      <div className="border-b border-white/10 px-3 py-3">
        <p className="text-meta uppercase tracking-wide text-white/70">
          Navigation
        </p>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2 rounded px-2 py-2 text-body transition-colors md:py-1.5",
                active
                  ? "border-l-2 border-kengen-green bg-white/10 font-medium"
                  : "border-l-2 border-transparent text-white/80 hover:bg-white/5"
              )}
              title={item.label}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
