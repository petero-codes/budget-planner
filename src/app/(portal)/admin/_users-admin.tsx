"use client";

import { useEffect, useMemo, useState } from "react";
import { ActionLink, Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { apiGet, apiSend, ApiError } from "@/lib/client/client-api";
import type {
  CostCenter,
  Department,
  Position,
  User,
} from "@/domain/entities";

type RoleDefinition = { code: string; name: string };
type AdminData = {
  users: User[];
  positions: Position[];
  departments: Department[];
  costCenters: CostCenter[];
  roles: RoleDefinition[];
};

type UserForm = {
  name: string;
  email: string;
  positionId: string;
  managerId: string;
  departmentId: string;
  primaryCostCenterId: string;
  roleCodes: string[];
  temporaryPassword: string;
};

const blankForm: UserForm = {
  name: "",
  email: "",
  positionId: "",
  managerId: "",
  departmentId: "",
  primaryCostCenterId: "",
  roleCodes: [],
  temporaryPassword: "",
};

function friendlyActionError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.status >= 500) {
      return `${fallback} Please try again or contact ICT Support if the problem persists.`;
    }
    return err.message;
  }
  return err instanceof Error ? err.message : fallback;
}

function deactivateBlockReason(
  user: User,
  actorId: string | null,
  users: User[]
): string | null {
  if (actorId && user.id === actorId) {
    return "You cannot deactivate your own account.";
  }
  if (user.roleCodes.includes("SystemAdmin")) {
    const otherAdmins = users.filter(
      (candidate) =>
        candidate.id !== user.id &&
        candidate.active &&
        candidate.roleCodes.includes("SystemAdmin")
    );
    if (otherAdmins.length === 0) {
      return "Cannot deactivate the only active System Administrator.";
    }
  }
  if (user.roleCodes.includes("GeneralManager")) {
    const otherGm = users.filter(
      (candidate) =>
        candidate.id !== user.id &&
        candidate.active &&
        candidate.roleCodes.includes("GeneralManager")
    );
    if (otherGm.length === 0) {
      return "Cannot deactivate the only active General Manager. Assign another GM first.";
    }
  }
  if (user.roleCodes.includes("FinanceAdministrator")) {
    const otherFinance = users.filter(
      (candidate) =>
        candidate.id !== user.id &&
        candidate.active &&
        candidate.roleCodes.includes("FinanceAdministrator")
    );
    if (otherFinance.length === 0) {
      return "Cannot deactivate the only active Finance Administrator.";
    }
  }
  return null;
}

export function UsersAdmin() {
  const [data, setData] = useState<AdminData | null>(null);
  const [actorId, setActorId] = useState<string | null>(null);
  const [form, setForm] = useState<UserForm>(blankForm);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<User | null>(null);
  const [activateTarget, setActivateTarget] = useState<User | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  async function load() {
    const [result, me] = await Promise.all([
      apiGet<AdminData>("/api/v1/admin/users"),
      apiGet<{ user: User }>("/api/v1/me"),
    ]);
    setData(result);
    setActorId(me.user.id);
    setForm((current) =>
      current.positionId
        ? current
        : {
            ...current,
            positionId: result.positions[0]?.id ?? "",
            departmentId: result.departments[0]?.id ?? "",
            primaryCostCenterId: result.costCenters[0]?.id ?? "",
            roleCodes: result.roles.some(
              (role) => role.code === "BudgetSubmitter"
            )
              ? ["BudgetSubmitter"]
              : result.roles[0]
                ? [result.roles[0].code]
                : [],
          }
    );
  }

  useEffect(() => {
    void load().catch((err) =>
      setError(err instanceof Error ? err.message : "Failed to load administration")
    );
  }, []);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!data || !query) return data?.users ?? [];
    return data.users.filter(
      (user) =>
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.roleCodes.some((role) => role.toLowerCase().includes(query))
    );
  }, [data, search]);

  const availableCostCenters = useMemo(
    () =>
      (data?.costCenters ?? []).filter(
        (center) => center.departmentId === form.departmentId && center.isActive
      ),
    [data, form.departmentId]
  );

  function startCreate() {
    if (!data) return;
    setShowCreate(true);
    setError(null);
    setNotice(null);
    const departmentId = data.departments[0]?.id ?? "";
    setForm({
      ...blankForm,
      positionId: data.positions[0]?.id ?? "",
      departmentId,
      primaryCostCenterId:
        data.costCenters.find(
          (center) => center.departmentId === departmentId && center.isActive
        )?.id ?? "",
      roleCodes: data.roles.some((role) => role.code === "BudgetSubmitter")
        ? ["BudgetSubmitter"]
        : data.roles[0]
          ? [data.roles[0].code]
          : [],
    });
  }

  function changeDepartment(departmentId: string) {
    const firstCenter = data?.costCenters.find(
      (center) => center.departmentId === departmentId && center.isActive
    );
    setForm((current) => ({
      ...current,
      departmentId,
      primaryCostCenterId: firstCenter?.id ?? "",
    }));
  }

  function toggleRole(code: string) {
    setForm((current) => ({
      ...current,
      roleCodes: current.roleCodes.includes(code)
        ? current.roleCodes.filter((role) => role !== code)
        : [...current.roleCodes, code],
    }));
  }

  function patchUserRow(updated: User) {
    setData((current) =>
      current
        ? {
            ...current,
            users: current.users.map((user) =>
              user.id === updated.id ? updated : user
            ),
          }
        : current
    );
  }

  async function saveUser(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const created = await apiSend<User>("/api/v1/admin/users", "POST", {
        name: form.name,
        email: form.email,
        positionId: form.positionId,
        managerId: form.managerId || null,
        departmentId: form.departmentId,
        primaryCostCenterId: form.primaryCostCenterId,
        roleCodes: form.roleCodes,
        active: true,
        temporaryPassword: form.temporaryPassword,
      });
      setData((current) =>
        current ? { ...current, users: [...current.users, created] } : current
      );
      setShowCreate(false);
      setForm(blankForm);
      setNotice(
        "User account created. Give the temporary password to the user securely."
      );
    } catch (err) {
      setError(friendlyActionError(err, "Unable to save changes."));
    } finally {
      setBusy(false);
    }
  }

  async function confirmReset() {
    if (!resetTarget) return;
    if (resetPassword.trim().length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setActionBusy(true);
    setError(null);
    try {
      await apiSend(`/api/v1/admin/users/${resetTarget.id}/reset-password`, "POST", {
        password: resetPassword,
      });
      setResetResult(resetPassword);
      setNotice("Password reset successfully.");
    } catch (err) {
      setError(friendlyActionError(err, "Unable to reset password."));
      setResetTarget(null);
      setResetPassword("");
    } finally {
      setActionBusy(false);
    }
  }

  async function confirmDeactivate() {
    if (!deactivateTarget) return;
    setActionBusy(true);
    setError(null);
    try {
      const updated = await apiSend<User>(
        `/api/v1/admin/users/${deactivateTarget.id}`,
        "DELETE"
      );
      patchUserRow(updated);
      setNotice("User deactivated successfully.");
      setDeactivateTarget(null);
    } catch (err) {
      setError(friendlyActionError(err, "Unable to deactivate user."));
    } finally {
      setActionBusy(false);
    }
  }

  async function confirmActivate() {
    if (!activateTarget) return;
    setActionBusy(true);
    setError(null);
    try {
      const updated = await apiSend<User>(
        `/api/v1/admin/users/${activateTarget.id}/activate`,
        "POST"
      );
      patchUserRow(updated);
      setNotice("User activated successfully.");
      setActivateTarget(null);
    } catch (err) {
      setError(friendlyActionError(err, "Unable to activate user."));
    } finally {
      setActionBusy(false);
    }
  }

  async function copyTempPassword() {
    if (!resetResult) return;
    try {
      await navigator.clipboard.writeText(resetResult);
      setNotice("Password copied.");
    } catch {
      setNotice("Copy failed — select and copy the password manually.");
    }
  }

  if (!data) {
    return (
      <p className="text-neutral-600">
        {error ?? "Loading user administration…"}
      </p>
    );
  }

  const selectClass = "glass-select mt-1 w-full";
  const managerOptions = data.users.filter((user) => user.active);

  return (
    <div>
      {error ? (
        <p
          role="alert"
          className="mb-3 rounded border border-kengen-red/30 bg-red-50 px-3 py-2 text-body text-kengen-red"
        >
          {error}
        </p>
      ) : null}
      {notice ? (
        <p
          role="status"
          className="mb-3 rounded border border-kengen-green/30 bg-emerald-50 px-3 py-2 text-body text-kengen-green"
        >
          {notice}
        </p>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-meta text-neutral-600">
          Edit opens the full user profile. Reset password and deactivate stay
          on this page.
        </p>
        <Button
          type="button"
          variant="primary"
          size="compact"
          onClick={startCreate}
        >
          Create user
        </Button>
      </div>

      {showCreate ? (
        <form
          onSubmit={saveUser}
          className="mb-5 rounded border border-neutral-400/30 bg-white p-4"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-medium text-kengen-navy">Create user</h2>
            <Button
              type="button"
              variant="secondary"
              size="compact"
              disabled={busy}
              onClick={() => setShowCreate(false)}
            >
              Cancel
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <TextField
              label="Full name"
              value={form.name}
              onChange={(name) => setForm((current) => ({ ...current, name }))}
              required
            />
            <TextField
              label="KenGen email"
              type="email"
              value={form.email}
              onChange={(email) =>
                setForm((current) => ({ ...current, email }))
              }
              placeholder="firstname.lastname@kengen.co.ke"
              required
            />
            <TextField
              label="Temporary password"
              type="password"
              value={form.temporaryPassword}
              onChange={(temporaryPassword) =>
                setForm((current) => ({ ...current, temporaryPassword }))
              }
              hint="At least 8 characters with letters and numbers"
              required
            />

            <label className="block text-meta">
              Position
              <select
                className={selectClass}
                value={form.positionId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    positionId: event.target.value,
                  }))
                }
                required
              >
                {data.positions.map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-meta">
              Direct manager
              <select
                className={selectClass}
                value={form.managerId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    managerId: event.target.value,
                  }))
                }
              >
                <option value="">No manager (organization root)</option>
                {managerOptions.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-meta">
              Department
              <select
                className={selectClass}
                value={form.departmentId}
                onChange={(event) => changeDepartment(event.target.value)}
                required
              >
                {data.departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-meta">
              Primary cost center
              <select
                className={selectClass}
                value={form.primaryCostCenterId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    primaryCostCenterId: event.target.value,
                  }))
                }
                required
              >
                {availableCostCenters.map((center) => (
                  <option key={center.id} value={center.id}>
                    {center.code} — {center.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <fieldset className="mt-4">
            <legend className="text-meta font-medium text-kengen-navy">
              Roles
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {data.roles.map((role) => (
                <label
                  key={role.code}
                  className="flex items-center gap-2 rounded border border-neutral-400/30 px-2.5 py-1.5 text-body"
                >
                  <input
                    type="checkbox"
                    checked={form.roleCodes.includes(role.code)}
                    onChange={() => toggleRole(role.code)}
                  />
                  {role.name}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mt-4">
            <Button
              type="submit"
              variant="primary"
              loading={busy}
              loadingLabel="Saving…"
            >
              Create user
            </Button>
          </div>
        </form>
      ) : null}

      <section className="rounded border border-neutral-400/30 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-400/20 p-3">
          <div>
            <h2 className="font-medium text-kengen-navy">User accounts</h2>
            <p className="text-meta text-neutral-600">
              {data.users.filter((user) => user.active).length} active of{" "}
              {data.users.length} total
            </p>
          </div>
          <input
            className="glass-select max-w-xs"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search…"
            aria-label="Search user accounts"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-body">
            <thead className="bg-neutral-100 text-meta uppercase text-neutral-700">
              <tr>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Roles</th>
                <th className="px-3 py-2">Manager</th>
                <th className="px-3 py-2">Cost center</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const manager = data.users.find(
                  (candidate) => candidate.id === user.managerId
                );
                const center = data.costCenters.find(
                  (candidate) => candidate.id === user.primaryCostCenterId
                );
                const blockReason = user.active
                  ? deactivateBlockReason(user, actorId, data.users)
                  : null;
                return (
                  <tr key={user.id} className="border-t border-neutral-400/20">
                    <td className="px-3 py-2">
                      <p className="font-medium text-kengen-navy">
                        {user.name}
                      </p>
                      <p className="text-meta text-neutral-600">{user.email}</p>
                    </td>
                    <td className="px-3 py-2 text-meta">
                      {user.roleCodes.join(", ")}
                    </td>
                    <td className="px-3 py-2 text-meta">
                      {manager?.name ?? "— (root)"}
                    </td>
                    <td className="px-3 py-2 text-meta">
                      {center ? `${center.code} — ${center.name}` : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          user.active
                            ? "text-kengen-green"
                            : "text-neutral-500"
                        }
                      >
                        {user.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <ActionLink
                          href={`/admin/users/${user.id}`}
                          variant="secondary"
                          size="compact"
                        >
                          Edit
                        </ActionLink>
                        <Button
                          type="button"
                          variant="secondary"
                          size="compact"
                          disabled={!user.active || actionBusy}
                          title={
                            !user.active
                              ? "Reactivate the account before resetting its password"
                              : undefined
                          }
                          onClick={() => {
                            setResetTarget(user);
                            setResetPassword("");
                            setResetResult(null);
                            setError(null);
                          }}
                        >
                          Reset password
                        </Button>
                        {user.active ? (
                          <Button
                            type="button"
                            variant="danger"
                            size="compact"
                            disabled={Boolean(blockReason) || actionBusy}
                            title={blockReason ?? undefined}
                            onClick={() => {
                              setDeactivateTarget(user);
                              setError(null);
                            }}
                          >
                            Deactivate
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="success"
                            size="compact"
                            disabled={actionBusy}
                            onClick={() => {
                              setActivateTarget(user);
                              setError(null);
                            }}
                          >
                            Activate
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <ConfirmDialog
        open={Boolean(resetTarget) && !resetResult}
        title="Reset password?"
        confirmLabel="Reset Password"
        confirmVariant="primary"
        busy={actionBusy}
        loadingLabel="Resetting…"
        confirmDisabled={resetPassword.trim().length < 8}
        onCancel={() => {
          if (!actionBusy) {
            setResetTarget(null);
            setResetPassword("");
          }
        }}
        onConfirm={() => void confirmReset()}
      >
        <p className="mb-3">
          Enter a new password for <strong>{resetTarget?.name}</strong>. This
          becomes their permanent sign-in password.
        </p>
        <TextField
          label="New password"
          type="password"
          value={resetPassword}
          onChange={setResetPassword}
          hint="At least 8 characters with letters and numbers"
          required
        />
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(resetResult)}
        title="Password reset successfully"
        confirmLabel="Done"
        confirmVariant="primary"
        onCancel={() => {
          setResetTarget(null);
          setResetPassword("");
          setResetResult(null);
        }}
        onConfirm={() => {
          setResetTarget(null);
          setResetPassword("");
          setResetResult(null);
        }}
      >
        <p className="mb-3">
          The password is active immediately. Share it securely with the user.
        </p>
        <div className="flex items-center gap-2 rounded border border-neutral-400/40 bg-neutral-50 px-3 py-2 font-mono text-body">
          <span className="flex-1 break-all">{resetResult}</span>
          <Button
            type="button"
            variant="secondary"
            size="compact"
            onClick={() => void copyTempPassword()}
          >
            Copy
          </Button>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        title="Deactivate User"
        confirmLabel="Deactivate"
        confirmVariant="danger"
        busy={actionBusy}
        loadingLabel="Deactivating…"
        onCancel={() => {
          if (!actionBusy) setDeactivateTarget(null);
        }}
        onConfirm={() => void confirmDeactivate()}
      >
        {deactivateTarget ? (
          <div className="space-y-2">
            <p>
              <span className="text-meta text-neutral-600">Name:</span>{" "}
              {deactivateTarget.name}
            </p>
            <p>
              <span className="text-meta text-neutral-600">Position:</span>{" "}
              {data.positions.find(
                (position) => position.id === deactivateTarget.positionId
              )?.title ?? "—"}
            </p>
            <p>
              <span className="text-meta text-neutral-600">Department:</span>{" "}
              {data.departments.find(
                (department) => department.id === deactivateTarget.departmentId
              )?.name ?? "—"}
            </p>
            <p className="pt-1">
              This user will immediately lose access.
            </p>
          </div>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(activateTarget)}
        title="Activate this user?"
        confirmLabel="Activate"
        confirmVariant="success"
        busy={actionBusy}
        loadingLabel="Activating…"
        onCancel={() => {
          if (!actionBusy) setActivateTarget(null);
        }}
        onConfirm={() => void confirmActivate()}
      >
        <p>
          <strong>{activateTarget?.name}</strong> will be able to sign in again.
        </p>
      </ConfirmDialog>
    </div>
  );
}
