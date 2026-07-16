"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PageShell } from "@/components/shared/page-shell";
import { apiGet } from "@/lib/client-api";
import type { CostCenter, Position, User } from "@/domain/entities";

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [cc, setCc] = useState<CostCenter | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const me = await apiGet<{
          user: User;
          position: Position | null;
        }>("/api/v1/me");
        setUser(me.user);
        setPosition(me.position);
        const ref = await apiGet<{ costCenters: CostCenter[] }>(
          "/api/v1/reference"
        );
        setCc(
          ref.costCenters.find((c) => c.id === me.user.primaryCostCenterId) ??
            null
        );
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load profile");
      }
    })();
  }, []);

  if (error) {
    return (
      <PageShell>
        <p className="text-kengen-red">{error}</p>
      </PageShell>
    );
  }

  if (!user) {
    return (
      <PageShell>
        <p className="text-meta">Loading…</p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader title="My Profile" />
      <div className="grid flex-1 gap-4 md:grid-cols-2">
        <div className="rounded border border-neutral-400/30 bg-white p-4 md:h-full">
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
          <p className="mt-2 text-meta">Roles: {user.roleCodes.join(", ")}</p>
        </div>
        <div className="rounded border border-neutral-400/30 bg-white p-4 text-body md:h-full">
          <p className="mb-2 font-medium text-kengen-navy">Security</p>
          <p className="text-meta text-neutral-700">
            Password / MFA managed by corporate directory (SSO in a later phase).
          </p>
        </div>
      </div>
    </PageShell>
  );
}
