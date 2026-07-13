"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { User } from "@/domain/entities";
import { getNavItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function Sidebar({
  user,
  collapsed,
}: {
  user: User;
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const items = getNavItems(user);

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-kengen-navy/20 bg-kengen-navy text-white",
        collapsed ? "w-14" : "w-56"
      )}
    >
      <div className="border-b border-white/10 px-3 py-3">
        <p className={cn("text-meta uppercase tracking-wide text-white/70", collapsed && "sr-only")}>
          Navigation
        </p>
      </div>
      <nav className="flex-1 space-y-0.5 p-2">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded px-2 py-1.5 text-body transition-colors",
                active
                  ? "border-l-2 border-kengen-green bg-white/10 font-medium"
                  : "border-l-2 border-transparent text-white/80 hover:bg-white/5"
              )}
              title={item.label}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed ? <span>{item.label}</span> : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
