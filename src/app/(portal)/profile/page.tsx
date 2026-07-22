"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PageShell } from "@/components/shared/page-shell";
import { apiGet } from "@/lib/client-api";
import type { CostCenter, Department, Position, User } from "@/domain/entities";

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);
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
        const ref = await apiGet<{
          costCenters: CostCenter[];
          departments: Department[];
        }>("/api/v1/reference");
        setCc(
          ref.costCenters.find((c) => c.id === me.user.primaryCostCenterId) ??
            null
        );
        setDepartment(
          ref.departments.find((d) => d.id === me.user.departmentId) ?? null
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

  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");

  return (
    <PageShell>
      <PageHeader title="My Profile" />
      <div className="grid flex-1 gap-4 md:grid-cols-2">
        <div className="rounded border border-neutral-400/30 bg-white p-4 md:h-full">
          <p className="mb-3 text-meta font-medium uppercase tracking-wide text-neutral-600">
            Account
          </p>
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-kengen-navy text-lg text-white">
            {initials}
          </div>
          <dl className="space-y-2 text-body">
            <div>
              <dt className="text-meta text-neutral-600">Name</dt>
              <dd className="font-medium text-kengen-navy">{user.name}</dd>
            </div>
            <div>
              <dt className="text-meta text-neutral-600">Email</dt>
              <dd className="text-neutral-800">{user.email}</dd>
            </div>
            <div>
              <dt className="text-meta text-neutral-600">Position</dt>
              <dd>{position?.title ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-meta text-neutral-600">Department</dt>
              <dd>
                {department
                  ? `${department.code} — ${department.name}`
                  : user.departmentId}
              </dd>
            </div>
            <div>
              <dt className="text-meta text-neutral-600">Cost center</dt>
              <dd>
                {cc ? `${cc.code} — ${cc.name}` : user.primaryCostCenterId}
              </dd>
            </div>
            <div>
              <dt className="text-meta text-neutral-600">Roles</dt>
              <dd className="text-meta">{user.roleCodes.join(", ")}</dd>
            </div>
          </dl>
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
