"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Wrench } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { PageShell } from "@/components/shared/page-shell";
import { apiGet } from "@/lib/client-api";
import type { User } from "@/domain/entities";
import { UsersAdmin } from "./_users-admin";
import {
  CostCentersAdmin,
  DepartmentsAdmin,
  FiscalYearsAdmin,
} from "./_master-data-admin";

const TABS = [
  { id: "users", label: "Users" },
  { id: "departments", label: "Departments" },
  { id: "cost-centers", label: "Cost Centers" },
  { id: "fiscal-years", label: "Financial Years" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function canAccessAdmin(user: User): boolean {
  return (
    user.permissionCodes.includes("admin.users") ||
    user.permissionCodes.includes("admin.masterdata")
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("users");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDevTools, setShowDevTools] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const me = await apiGet<{
          user: User;
          developmentToolkitEnabled?: boolean;
        }>("/api/v1/me");
        if (!canAccessAdmin(me.user)) {
          router.replace("/access-denied");
          return;
        }
        setShowDevTools(
          Boolean(me.developmentToolkitEnabled) &&
            me.user.roleCodes.includes("SystemAdmin")
        );
        setReady(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      }
    })();
  }, [router]);

  if (error) {
    return <p className="p-4 text-kengen-red">{error}</p>;
  }
  if (!ready) {
    return <p className="p-4 text-meta">Loading administration…</p>;
  }

  return (
    <PageShell>
      <PageHeader title="Administration" />

      {showDevTools ? (
        <Link
          href="/admin/development"
          className="mb-5 flex items-center gap-3 border border-amber-600/40 bg-amber-50 px-4 py-3 text-body text-amber-950 transition hover:bg-amber-100"
        >
          <Wrench className="h-5 w-5 shrink-0" aria-hidden />
          <span>
            <span className="font-medium">Development Tools</span>
            <span className="mt-0.5 block text-meta text-amber-900/80">
              Clone FY, demo budgets, workflow simulator, health &amp; diagnostics
            </span>
          </span>
        </Link>
      ) : null}

      <nav className="mb-5 flex flex-wrap gap-1 border-b border-neutral-400/30">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={
              "rounded-t px-4 py-2 text-body transition " +
              (tab === item.id
                ? "border-b-2 border-kengen-green font-medium text-kengen-navy"
                : "text-neutral-600 hover:text-kengen-navy")
            }
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === "users" ? <UsersAdmin /> : null}
      {tab === "departments" ? <DepartmentsAdmin /> : null}
      {tab === "cost-centers" ? <CostCentersAdmin /> : null}
      {tab === "fiscal-years" ? <FiscalYearsAdmin /> : null}
    </PageShell>
  );
}
