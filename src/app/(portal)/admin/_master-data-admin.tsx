"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { apiGet, apiSend } from "@/lib/client-api";
import type {
  CostCenter,
  CostCenterSubmissionStatus,
  Department,
  FiscalYear,
  User,
} from "@/domain/entities";
import { SUBMISSION_STATUS_LABEL } from "@/domain/rules/submission-status";

function Feedback({
  error,
  notice,
}: {
  error: string | null;
  notice: string | null;
}) {
  return (
    <>
      {error ? (
        <p className="mb-3 rounded border border-kengen-red/30 bg-red-50 px-3 py-2 text-body text-kengen-red">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="mb-3 rounded border border-kengen-green/30 bg-emerald-50 px-3 py-2 text-body text-kengen-green">
          {notice}
        </p>
      ) : null}
    </>
  );
}

const selectClass = "glass-select mt-1 w-full";

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

export function DepartmentsAdmin() {
  const [departments, setDepartments] = useState<Department[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    setDepartments(await apiGet<Department[]>("/api/v1/admin/departments"));
  }

  useEffect(() => {
    void load().catch((err) =>
      setError(err instanceof Error ? err.message : "Failed to load departments")
    );
  }, []);

  function reset() {
    setEditingId(null);
    setName("");
    setCode("");
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const body = { name, code, isActive: true };
      if (editingId) {
        const current = departments?.find((d) => d.id === editingId);
        await apiSend(`/api/v1/admin/departments/${editingId}`, "PATCH", {
          ...body,
          isActive: current?.isActive ?? true,
        });
      } else {
        await apiSend("/api/v1/admin/departments", "POST", body);
      }
      await load();
      reset();
      setNotice(editingId ? "Department updated." : "Department created.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save department");
    } finally {
      setBusy(false);
    }
  }

  async function setActive(department: Department, isActive: boolean) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await apiSend(`/api/v1/admin/departments/${department.id}`, "PATCH", {
        name: department.name,
        code: department.code,
        isActive,
      });
      await load();
      setNotice(isActive ? "Department restored." : "Department archived.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update department");
    } finally {
      setBusy(false);
    }
  }

  if (!departments) {
    return <p className="text-neutral-600">{error ?? "Loading departments…"}</p>;
  }

  return (
    <div>
      <Feedback error={error} notice={notice} />
      <form
        onSubmit={save}
        className="mb-5 rounded border border-neutral-400/30 bg-white p-4"
      >
        <h2 className="mb-3 font-medium text-kengen-navy">
          {editingId ? "Edit department" : "Create department"}
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          <TextField label="Name" value={name} onChange={setName} required />
          <TextField label="Code" value={code} onChange={setCode} required />
          <div className="flex items-end gap-2">
            <Button type="submit" variant="primary" loading={busy}>
              {editingId ? "Save" : "Create"}
            </Button>
            {editingId ? (
              <Button type="button" variant="secondary"
                        size="compact" onClick={reset}>
                Cancel
              </Button>
            ) : null}
          </div>
        </div>
      </form>

      <section className="rounded border border-neutral-400/30 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-body">
            <thead className="bg-neutral-100 text-meta uppercase text-neutral-700">
              <tr>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((department) => (
                <tr key={department.id} className="border-t border-neutral-400/20">
                  <td className="px-3 py-2 font-medium text-kengen-navy">
                    {department.code}
                  </td>
                  <td className="px-3 py-2">{department.name}</td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        department.isActive
                          ? "text-kengen-green"
                          : "text-neutral-500"
                      }
                    >
                      {department.isActive ? "Active" : "Archived"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="secondary"
                        size="compact"
                        onClick={() => {
                          setEditingId(department.id);
                          setName(department.name);
                          setCode(department.code);
                          setError(null);
                          setNotice(null);
                        }}
                      >
                        Edit
                      </Button>
                      {department.isActive ? (
                        <Button
                          type="button"
                          variant="danger"
                          size="compact"
                          disabled={busy}
                          onClick={() => void setActive(department, false)}
                        >
                          Archive
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="secondary"
                          size="compact"
                          disabled={busy}
                          onClick={() => void setActive(department, true)}
                        >
                          Restore
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cost centers
// ---------------------------------------------------------------------------

type CostCenterData = {
  costCenters: CostCenter[];
  departments: Department[];
  users: User[];
};

type CostCenterForm = {
  code: string;
  sapCostCenterCode: string;
  name: string;
  departmentId: string;
  managerId: string;
  responsiblePersonId: string;
  isActive: boolean;
};

const blankCostCenter: CostCenterForm = {
  code: "",
  sapCostCenterCode: "",
  name: "",
  departmentId: "",
  managerId: "",
  responsiblePersonId: "",
  isActive: true,
};

export function CostCentersAdmin() {
  const [data, setData] = useState<CostCenterData | null>(null);
  const [form, setForm] = useState<CostCenterForm>(blankCostCenter);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    const result = await apiGet<CostCenterData>("/api/v1/admin/cost-centers");
    setData(result);
    setForm((current) =>
      current.departmentId
        ? current
        : { ...current, departmentId: result.departments[0]?.id ?? "" }
    );
  }

  useEffect(() => {
    void load().catch((err) =>
      setError(err instanceof Error ? err.message : "Failed to load cost centers")
    );
  }, []);

  const userName = useMemo(() => {
    const map = new Map((data?.users ?? []).map((u) => [u.id, u.name]));
    return (id: string | null) => (id ? map.get(id) ?? "—" : "—");
  }, [data]);

  const departmentName = useMemo(() => {
    const map = new Map((data?.departments ?? []).map((d) => [d.id, d.name]));
    return (id: string) => map.get(id) ?? "—";
  }, [data]);

  function reset() {
    setEditingId(null);
    setForm({
      ...blankCostCenter,
      departmentId: data?.departments.find((d) => d.isActive)?.id ?? "",
    });
    setError(null);
    setNotice(null);
  }

  function startEdit(center: CostCenter) {
    setEditingId(center.id);
    setForm({
      code: center.code,
      sapCostCenterCode: center.sapCostCenterCode ?? "",
      name: center.name,
      departmentId: center.departmentId,
      managerId: center.managerId ?? "",
      responsiblePersonId: center.responsiblePersonId ?? "",
      isActive: center.isActive,
    });
    setError(null);
    setNotice(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const body = {
        code: form.code,
        sapCostCenterCode: form.sapCostCenterCode || null,
        name: form.name,
        departmentId: form.departmentId,
        managerId: form.managerId || null,
        responsiblePersonId: form.responsiblePersonId || null,
        isActive: form.isActive,
      };
      if (editingId) {
        await apiSend(`/api/v1/admin/cost-centers/${editingId}`, "PATCH", body);
      } else {
        await apiSend("/api/v1/admin/cost-centers", "POST", body);
      }
      await load();
      reset();
      setNotice(editingId ? "Cost center updated." : "Cost center created.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save cost center");
    } finally {
      setBusy(false);
    }
  }

  async function archive(center: CostCenter) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await apiSend(`/api/v1/admin/cost-centers/${center.id}`, "PATCH", {
        code: center.code,
        sapCostCenterCode: center.sapCostCenterCode,
        name: center.name,
        departmentId: center.departmentId,
        managerId: center.managerId,
        responsiblePersonId: center.responsiblePersonId,
        isActive: false,
      });
      await load();
      setNotice("Cost center archived.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to archive cost center");
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return <p className="text-neutral-600">{error ?? "Loading cost centers…"}</p>;
  }

  const activeUsers = data.users.filter((u) => u.active);

  return (
    <div>
      <Feedback error={error} notice={notice} />
      <form
        onSubmit={save}
        className="mb-5 rounded border border-neutral-400/30 bg-white p-4"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium text-kengen-navy">
            {editingId ? "Edit cost center" : "Create cost center"}
          </h2>
          {editingId ? (
            <Button type="button" variant="secondary"
                        size="compact" onClick={reset}>
              Cancel edit
            </Button>
          ) : null}
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <TextField
            label="Code"
            value={form.code}
            onChange={(code) => setForm((c) => ({ ...c, code }))}
            required
          />
          <TextField
            label="SAP cost center code"
            value={form.sapCostCenterCode}
            onChange={(sapCostCenterCode) =>
              setForm((c) => ({ ...c, sapCostCenterCode }))
            }
          />
          <TextField
            label="Name"
            value={form.name}
            onChange={(name) => setForm((c) => ({ ...c, name }))}
            required
          />

          <label className="block text-meta">
            Department
            <select
              className={selectClass}
              value={form.departmentId}
              onChange={(event) =>
                setForm((c) => ({ ...c, departmentId: event.target.value }))
              }
              required
            >
              {data.departments
                .filter((d) => d.isActive || d.id === form.departmentId)
                .map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
            </select>
          </label>

          <label className="block text-meta">
            Manager (approver)
            <select
              className={selectClass}
              value={form.managerId}
              onChange={(event) =>
                setForm((c) => ({ ...c, managerId: event.target.value }))
              }
            >
              <option value="">Unassigned</option>
              {activeUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-meta">
            Responsible person (Budget Holder)
            <select
              className={selectClass}
              value={form.responsiblePersonId}
              onChange={(event) =>
                setForm((c) => ({
                  ...c,
                  responsiblePersonId: event.target.value,
                }))
              }
            >
              <option value="">Unassigned</option>
              {activeUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {editingId ? (
          <label className="mt-4 flex items-center gap-2 text-body">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) =>
                setForm((c) => ({ ...c, isActive: event.target.checked }))
              }
            />
            Cost center active
          </label>
        ) : null}

        <div className="mt-4">
          <Button type="submit" variant="primary" loading={busy}>
            {editingId ? "Save changes" : "Create cost center"}
          </Button>
        </div>
      </form>

      <section className="rounded border border-neutral-400/30 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-body">
            <thead className="bg-neutral-100 text-meta uppercase text-neutral-700">
              <tr>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Department</th>
                <th className="px-3 py-2">Manager</th>
                <th className="px-3 py-2">Responsible person</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.costCenters.map((center) => (
                <tr key={center.id} className="border-t border-neutral-400/20">
                  <td className="px-3 py-2 font-medium text-kengen-navy">
                    {center.code}
                  </td>
                  <td className="px-3 py-2">{center.name}</td>
                  <td className="px-3 py-2 text-meta">
                    {departmentName(center.departmentId)}
                  </td>
                  <td className="px-3 py-2 text-meta">
                    {userName(center.managerId)}
                  </td>
                  <td className="px-3 py-2 text-meta">
                    {userName(center.responsiblePersonId)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        center.isActive ? "text-kengen-green" : "text-neutral-500"
                      }
                    >
                      {center.isActive ? "Active" : "Archived"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="secondary"
                        size="compact"
                        onClick={() => startEdit(center)}
                      >
                        Edit
                      </Button>
                      {center.isActive ? (
                        <Button
                          type="button"
                          variant="danger"
                          size="compact"
                          disabled={busy}
                          onClick={() => void archive(center)}
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
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Financial years
// ---------------------------------------------------------------------------

type FiscalYearData = { fiscalYears: FiscalYear[]; currentId: string | null };

export function FiscalYearsAdmin() {
  const [data, setData] = useState<FiscalYearData | null>(null);
  const [yearLabel, setYearLabel] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statuses, setStatuses] = useState<CostCenterSubmissionStatus[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    const result = await apiGet<FiscalYearData>("/api/v1/admin/fiscal-years");
    setData(result);
    try {
      const summary = await apiGet<{
        statuses: CostCenterSubmissionStatus[];
      }>("/api/v1/admin/submission-status");
      setStatuses(summary.statuses);
    } catch {
      setStatuses([]);
    }
  }

  useEffect(() => {
    void load().catch((err) =>
      setError(err instanceof Error ? err.message : "Failed to load financial years")
    );
  }, []);

  async function openYear(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await apiSend("/api/v1/admin/fiscal-years", "POST", {
        yearLabel: Number(yearLabel),
        startDate,
        endDate,
      });
      await load();
      setYearLabel("");
      setStartDate("");
      setEndDate("");
      setNotice("Financial year opened.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open financial year");
    } finally {
      setBusy(false);
    }
  }

  async function act(fy: FiscalYear, action: string, label: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await apiSend(`/api/v1/admin/fiscal-years/${fy.id}`, "PATCH", { action });
      await load();
      setNotice(`Financial year ${fy.yearLabel}: ${label}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return <p className="text-neutral-600">{error ?? "Loading financial years…"}</p>;
  }

  const statusCounts = statuses.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <Feedback error={error} notice={notice} />

      <form
        onSubmit={openYear}
        className="mb-5 rounded border border-neutral-400/30 bg-white p-4"
      >
        <h2 className="mb-3 font-medium text-kengen-navy">Open financial year</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <TextField
            label="Year label"
            type="number"
            value={yearLabel}
            onChange={setYearLabel}
            placeholder="2028"
            required
          />
          <TextField
            label="Start date"
            type="date"
            value={startDate}
            onChange={setStartDate}
            required
          />
          <TextField
            label="End date"
            type="date"
            value={endDate}
            onChange={setEndDate}
            required
          />
          <div className="flex items-end">
            <Button type="submit" variant="primary" loading={busy}>
              Open year
            </Button>
          </div>
        </div>
      </form>

      <section className="mb-5 rounded border border-neutral-400/30 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-body">
            <thead className="bg-neutral-100 text-meta uppercase text-neutral-700">
              <tr>
                <th className="px-3 py-2">Year</th>
                <th className="px-3 py-2">Period</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Current</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.fiscalYears.map((fy) => (
                <tr key={fy.id} className="border-t border-neutral-400/20">
                  <td className="px-3 py-2 font-medium text-kengen-navy">
                    FY{fy.yearLabel}
                  </td>
                  <td className="px-3 py-2 text-meta">
                    {fy.startDate} → {fy.endDate}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        fy.status === "Open"
                          ? "text-kengen-green"
                          : "text-neutral-500"
                      }
                    >
                      {fy.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {fy.isCurrent ? (
                      <span className="rounded bg-kengen-navy/10 px-2 py-0.5 text-meta text-kengen-navy">
                        Current
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      {!fy.isCurrent && fy.status !== "Archived" ? (
                        <Button
                          type="button"
                          variant="secondary"
                        size="compact"
                          disabled={busy}
                          onClick={() =>
                            void act(fy, "setCurrent", "set as current")
                          }
                        >
                          Set current
                        </Button>
                      ) : null}
                      {fy.status === "Open" ? (
                        <Button
                          type="button"
                          variant="warning"
                          size="compact"
                          disabled={busy}
                          onClick={() => void act(fy, "close", "closed")}
                        >
                          Close
                        </Button>
                      ) : null}
                      {fy.status === "Closed" ? (
                        <>
                          <Button
                            type="button"
                            variant="warning"
                            size="compact"
                            disabled={busy}
                            onClick={() => void act(fy, "reopen", "reopened")}
                          >
                            Reopen
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            size="compact"
                            disabled={busy}
                            onClick={() => void act(fy, "archive", "archived")}
                          >
                            Archive
                          </Button>
                        </>
                      ) : null}
                      {fy.status === "Archived" ? (
                        <Button
                          type="button"
                          variant="warning"
                          size="compact"
                          disabled={busy}
                          onClick={() => void act(fy, "reopen", "reopened")}
                        >
                          Reopen
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded border border-neutral-400/30 bg-white p-4">
        <h2 className="mb-3 font-medium text-kengen-navy">
          Submission status — current year
        </h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(SUBMISSION_STATUS_LABEL).map(([code, label]) => (
            <span
              key={code}
              className="rounded border border-neutral-400/30 px-2.5 py-1 text-meta"
            >
              {label}: <strong>{statusCounts[code] ?? 0}</strong>
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
