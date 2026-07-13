"use client";

import { Bell } from "lucide-react";
import type { Position, User } from "@/domain/entities";
import { UserDropdown } from "./user-dropdown";

export function Header({
  user,
  position,
  notificationCount,
}: {
  user: User;
  position?: Position | null;
  notificationCount: number;
}) {
  return (
    <header className="flex h-12 items-center justify-between border-b border-neutral-400/30 bg-white px-4">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded bg-kengen-green text-meta font-bold text-white">
          KG
        </div>
        <div>
          <p className="text-sm font-semibold text-kengen-navy">
            ICT Budgeting Portal
          </p>
          <p className="text-meta text-neutral-700">KenGen · Internal</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1 text-meta text-neutral-700">
          FY
          <select
            className="rounded border border-neutral-400/40 bg-white px-2 py-1 text-body"
            defaultValue="2027"
          >
            <option value="2027">2027</option>
          </select>
        </label>
        <button
          type="button"
          className="relative rounded p-1.5 text-kengen-navy hover:bg-neutral-100"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {notificationCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-kengen-red px-1 text-[10px] text-white">
              {notificationCount}
            </span>
          ) : null}
        </button>
        <UserDropdown user={user} positionTitle={position?.title} />
      </div>
    </header>
  );
}
