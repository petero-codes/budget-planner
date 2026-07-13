"use client";

import { useState } from "react";
import Link from "next/link";
import type { User } from "@/domain/entities";
import { ChevronDown } from "lucide-react";

export function UserDropdown({
  user,
  positionTitle,
}: {
  user: User;
  positionTitle?: string;
}) {
  const [open, setOpen] = useState(false);
  const isAdmin = user.roleCodes.includes("SystemAdmin");

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded border border-neutral-400/30 px-2 py-1 hover:bg-neutral-100"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-kengen-navy text-meta text-white">
          {user.name
            .split(" ")
            .map((p) => p[0])
            .slice(0, 2)
            .join("")}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-body font-medium text-neutral-900">
            {user.name}
          </span>
          <span className="block text-meta text-neutral-700">
            {positionTitle ?? user.roleCodes.join(", ")}
          </span>
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-neutral-700" />
      </button>
      {open ? (
        <div className="absolute right-0 z-50 mt-1 w-64 rounded border border-neutral-400/30 bg-white shadow-lg">
          <div className="border-b border-neutral-400/20 px-3 py-2">
            <p className="text-body font-medium">{user.name}</p>
            <p className="text-meta text-neutral-700">{user.email}</p>
            <p className="mt-1 text-meta text-neutral-400">
              {isAdmin
                ? "Administrator session"
                : "Signed in via KenGen SSO — your dashboard only"}
            </p>
          </div>
          <div className="p-1 text-body">
            <Link
              href="/profile"
              className="block rounded px-2 py-1.5 hover:bg-neutral-100"
              onClick={() => setOpen(false)}
            >
              My Profile
            </Link>
            <Link
              href="/login"
              className="block rounded px-2 py-1.5 text-kengen-red hover:bg-neutral-100"
              onClick={() => setOpen(false)}
            >
              Log Out
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
