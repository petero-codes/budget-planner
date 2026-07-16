"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Menu, X } from "lucide-react";
import type { FiscalYear, Position, User } from "@/domain/entities";
import { UserDropdown } from "./user-dropdown";
import { GlassSelect } from "@/components/ui/glass-select";
import { apiGet } from "@/lib/client-api";

export function Header({
  user,
  position,
  notificationCount,
  navOpen,
  onMenuClick,
}: {
  user: User;
  position?: Position | null;
  notificationCount: number;
  navOpen: boolean;
  onMenuClick: () => void;
}) {
  const [years, setYears] = useState<FiscalYear[]>([]);
  const [fy, setFy] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiGet<{ years: FiscalYear[]; activeId: string | null }>(
          "/api/v1/fiscal-years"
        );
        setYears(data.years);
        setFy(data.activeId ?? data.years[0]?.id ?? "");
      } catch {
        /* header FY is informational */
      }
    })();
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-12 items-center justify-between gap-2 border-b border-white/40 bg-white/70 px-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-xl sm:px-4">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          className="glass-trigger inline-flex h-9 w-9 shrink-0 items-center justify-center !rounded-xl text-kengen-navy md:hidden"
          aria-label={navOpen ? "Close menu" : "Open menu"}
          aria-expanded={navOpen}
          onClick={onMenuClick}
        >
          <span className="relative z-[1]">
            {navOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </span>
        </button>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-kengen-green text-meta font-bold text-white">
          KG
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-kengen-navy">
            ICT Budgeting Portal
          </p>
          <p className="hidden truncate text-meta text-neutral-700 sm:block">
            KenGen · Internal
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
        {years.length > 0 ? (
          <div className="hidden items-center gap-1.5 text-meta text-neutral-700 sm:flex">
            <span>FY</span>
            <GlassSelect
              aria-label="Fiscal year"
              className="min-w-[5.5rem]"
              value={fy}
              onChange={setFy}
              options={years.map((y) => ({
                value: y.id,
                label:
                  y.status === "Open"
                    ? String(y.yearLabel)
                    : `${y.yearLabel} (${y.status})`,
              }))}
            />
          </div>
        ) : null}
        <Link
          href="/notifications"
          className="glass-trigger relative !rounded-xl p-1.5 text-kengen-navy"
          aria-label="Notifications"
        >
          <Bell className="relative z-[1] h-4 w-4" />
          {notificationCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 z-[2] flex h-4 min-w-4 items-center justify-center rounded-full bg-kengen-red px-1 text-[10px] text-white">
              {notificationCount}
            </span>
          ) : null}
        </Link>
        <UserDropdown user={user} positionTitle={position?.title} />
      </div>
    </header>
  );
}
