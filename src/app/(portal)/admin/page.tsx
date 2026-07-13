"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { getCurrentUser, repos } from "@/infrastructure/di";
import type { CostCenter, User } from "@/domain/entities";

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [centers, setCenters] = useState<CostCenter[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const current = await getCurrentUser();
      if (!current.permissionCodes.includes("admin.users")) {
        setError("Administrator access required");
        router.replace("/access-denied");
        return;
      }
      setUser(current);
      setUsers(await repos.users.getAll());
      setCenters(await repos.costCenters.getAll());
    })();
  }, [router]);

  if (error) {
    return <p className="text-kengen-red">{error}</p>;
  }
  if (!user) {
    return <p className="text-meta">Loading…</p>;
  }

  return (
    <div>
      <PageHeader
        title="Administration"
        description="User & cost center management — System Administrator only"
      />
      <div className="mb-4 rounded border border-kengen-navy/20 bg-white p-3 text-body">
        <p className="font-medium text-kengen-navy">Signed in as admin</p>
        <p className="text-meta text-neutral-700">
          Staff use KenGen SSO and only see their own dashboards. This screen is
          not available to budget holders, managers, or the GM via SSO.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="overflow-x-auto rounded border border-neutral-400/30 bg-white">
          <p className="border-b border-neutral-400/20 bg-neutral-100 px-3 py-2 text-meta font-medium uppercase">
            Users
          </p>
          <table className="w-full text-left text-body">
            <thead className="text-meta uppercase text-neutral-700">
              <tr>
                <th className="px-2 py-1.5">Name</th>
                <th className="px-2 py-1.5">Roles</th>
                <th className="px-2 py-1.5">Manager</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-neutral-400/20">
                  <td className="px-2 py-1.5">{u.name}</td>
                  <td className="px-2 py-1.5 text-meta">
                    {u.roleCodes.join(", ")}
                  </td>
                  <td className="px-2 py-1.5 text-meta">
                    {u.managerId
                      ? users.find((m) => m.id === u.managerId)?.name ?? "—"
                      : "— (root)"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="overflow-x-auto rounded border border-neutral-400/30 bg-white">
          <p className="border-b border-neutral-400/20 bg-neutral-100 px-3 py-2 text-meta font-medium uppercase">
            Cost centers
          </p>
          <table className="w-full text-left text-body">
            <thead className="text-meta uppercase text-neutral-700">
              <tr>
                <th className="px-2 py-1.5">Code</th>
                <th className="px-2 py-1.5">SAP</th>
                <th className="px-2 py-1.5">Name</th>
              </tr>
            </thead>
            <tbody>
              {centers.map((c) => (
                <tr key={c.id} className="border-t border-neutral-400/20">
                  <td className="px-2 py-1.5">{c.code}</td>
                  <td className="px-2 py-1.5 text-meta">
                    {c.sapCostCenterCode ?? "—"}
                  </td>
                  <td className="px-2 py-1.5">{c.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
