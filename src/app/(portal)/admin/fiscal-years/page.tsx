"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Lock, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { PageShell } from "@/components/shared/page-shell";
import { StatusChip } from "@/components/shared/status-chip";
import { Button } from "@/components/ui/button";
import { apiGet, apiSend } from "@/lib/client/client-api";
import type { FiscalYear, User } from "@/domain/entities";

export default function FiscalYearsAdminPage() {
  const router = useRouter();
  const [years, setYears] = useState<FiscalYear[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [yearLabel, setYearLabel] = useState(2028);
  const [startDate, setStartDate] = useState("2027-07-01");
  const [endDate, setEndDate] = useState("2028-06-30");

  async function reload() {
    const data = await apiGet<{ years: FiscalYear[] }>("/api/v1/fiscal-years");
    setYears(data.years);
  }

  useEffect(() => {
    void (async () => {
      try {
        const me = await apiGet<{ user: User }>("/api/v1/me");
        if (!me.user.permissionCodes.includes("fy.manage")) {
          router.replace("/access-denied");
          return;
        }
        await reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      }
    })();
  }, [router]);

  async function act(id: string, action: "close" | "reopen" | "archive") {
    setBusy(true);
    setError(null);
    try {
      await apiSend(`/api/v1/fiscal-years/${id}/${action}`, "POST");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function createYear(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiSend("/api/v1/fiscal-years", "POST", {
        yearLabel,
        startDate,
        endDate,
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell>
      <PageHeader title="Financial Years" />
      {error ? (
        <p className="mb-3 rounded border border-kengen-red/30 bg-red-50 px-2 py-1.5 text-meta text-kengen-red">
          {error}
        </p>
      ) : null}

      <form
        onSubmit={createYear}
        className="mb-4 grid gap-2 rounded-2xl border border-white/50 bg-white/70 p-3 md:grid-cols-4"
      >
        <label className="text-meta">
          Year label
          <input
            type="number"
            className="glass-select mt-1"
            value={yearLabel}
            onChange={(e) => setYearLabel(Number(e.target.value))}
            required
          />
        </label>
        <label className="text-meta">
          Start
          <input
            type="date"
            className="glass-select mt-1"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </label>
        <label className="text-meta">
          End
          <input
            type="date"
            className="glass-select mt-1"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </label>
        <div className="flex items-end">
          <Button type="submit" variant="primary" fullWidth loading={busy}>
            Open new year
          </Button>
        </div>
      </form>

      <div className="overflow-x-auto rounded border border-neutral-400/30 bg-white">
        <table className="w-full text-left text-body">
          <thead className="bg-neutral-100 text-meta uppercase text-neutral-700">
            <tr>
              <th className="px-2 py-1.5">Year</th>
              <th className="px-2 py-1.5">Period</th>
              <th className="px-2 py-1.5">Status</th>
              <th className="px-2 py-1.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {years.map((fy) => (
              <tr key={fy.id} className="border-t border-neutral-400/20">
                <td className="px-2 py-1.5 font-medium">{fy.yearLabel}</td>
                <td className="px-2 py-1.5 text-meta">
                  {fy.startDate} → {fy.endDate}
                </td>
                <td className="px-2 py-1.5">
                  <StatusChip status={fy.status} />
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex flex-wrap gap-1.5">
                    {fy.status === "Open" ? (
                      <Button
                        type="button"
                        variant="warning"
                        size="compact"
                        icon={Lock}
                        loading={busy}
                        disabled={busy}
                        onClick={() => void act(fy.id, "close")}
                      >
                        Close
                      </Button>
                    ) : null}
                    {fy.status === "Closed" || fy.status === "Archived" ? (
                      <Button
                        type="button"
                        variant="warning"
                        size="compact"
                        icon={RotateCcw}
                        loading={busy}
                        disabled={busy}
                        onClick={() => void act(fy.id, "reopen")}
                      >
                        Reopen
                      </Button>
                    ) : null}
                    {fy.status === "Closed" ? (
                      <Button
                        type="button"
                        variant="danger"
                        size="compact"
                        icon={Archive}
                        loading={busy}
                        disabled={busy}
                        onClick={() => void act(fy.id, "archive")}
                      >
                        Archive
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
