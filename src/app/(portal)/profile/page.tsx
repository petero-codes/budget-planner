"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { getCurrentUser, repos } from "@/infrastructure/di";
import type { CostCenter, Position, User } from "@/domain/entities";
import { mockStore } from "@/infrastructure/repositories/mock/store";

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [cc, setCc] = useState<CostCenter | null>(null);

  useEffect(() => {
    void (async () => {
      const current = await getCurrentUser();
      setUser(current);
      setPosition(
        mockStore.positions.find((p) => p.id === current.positionId) ?? null
      );
      setCc(await repos.costCenters.getById(current.primaryCostCenterId));
    })();
  }, []);

  if (!user) return <p className="text-meta">Loading…</p>;

  return (
    <div>
      <PageHeader title="My Profile" description="Account details (admin-managed)" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded border border-neutral-400/30 bg-white p-4">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-kengen-navy text-lg text-white">
            {user.name
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")}
          </div>
          <p className="text-sm font-semibold text-kengen-navy">{user.name}</p>
          <p className="text-meta text-neutral-700">{user.email}</p>
          <p className="mt-2 text-body">{position?.title ?? "—"}</p>
          <p className="text-meta text-neutral-700">
            Cost center: {cc ? `${cc.code} — ${cc.name}` : user.primaryCostCenterId}
          </p>
          <p className="mt-2 text-meta">
            Roles: {user.roleCodes.join(", ")}
          </p>
        </div>
        <div className="rounded border border-neutral-400/30 bg-white p-4 text-body">
          <p className="mb-2 font-medium text-kengen-navy">Security</p>
          <p className="text-meta text-neutral-700">
            Password / MFA managed by corporate directory (SSO in a later phase).
          </p>
        </div>
      </div>
    </div>
  );
}
