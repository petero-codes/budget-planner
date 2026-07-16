"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { PageShell } from "@/components/shared/page-shell";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { ActionLink, Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { apiGet, apiSend, ApiError } from "@/lib/client-api";
import type {
  AuditLogEntry,
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

type DetailResponse = {
  user: User;
  audits: AuditLogEntry[];
};

type FormState = {
  name: string;
  email: string;
  positionId: string;
  managerId: string;
  departmentId: string;
  primaryCostCenterId: string;
  roleCodes: string[];
  active: boolean;
};

type SectionId =
  | "profile"
  | "organization"
  | "roles"
  | "account"
  | "security"
  | "audit";

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "organization", label: "Organization" },
  { id: "roles", label: "Roles & Permissions" },
  { id: "account", label: "Account" },
  { id: "security", label: "Security" },
  { id: "audit", label: "Audit History" },
];

function sectionFromQuery(value: string | null): SectionId {
  if (
    value === "profile" ||
    value === "organization" ||
    value === "roles" ||
    value === "account" ||
    value === "security" ||
    value === "audit"
  ) {
    return value;
  }
  return "profile";
}

function formFromUser(user: User): FormState {
  return {
    name: user.name,
    email: user.email,
    positionId: user.positionId,
    managerId: user.managerId ?? "",
    departmentId: user.departmentId,
    primaryCostCenterId: user.primaryCostCenterId,
    roleCodes: [...user.roleCodes],
    active: user.active,
  };
}

function formsEqual(a: FormState, b: FormState): boolean {
  return (
    a.name === b.name &&
    a.email === b.email &&
    a.positionId === b.positionId &&
    a.managerId === b.managerId &&
    a.departmentId === b.departmentId &&
    a.primaryCostCenterId === b.primaryCostCenterId &&
    a.active === b.active &&
    a.roleCodes.length === b.roleCodes.length &&
    a.roleCodes.every((role) => b.roleCodes.includes(role))
  );
}

function friendlyError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.status >= 500) {
      return `${fallback} Please try again or contact ICT Support if the problem persists.`;
    }
    return err.message;
  }
  return err instanceof Error ? err.message : fallback;
}

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = typeof params?.id === "string" ? params.id : "";

  const [section, setSection] = useState<SectionId>(() =>
    sectionFromQuery(searchParams?.get("section") ?? null)
  );
  const [refs, setRefs] = useState<AdminData | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [audits, setAudits] = useState<AuditLogEntry[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [baseline, setBaseline] = useState<FormState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const dirty = Boolean(form && baseline && !formsEqual(form, baseline));

  const load = useCallback(async () => {
    const [detail, admin] = await Promise.all([
      apiGet<DetailResponse>(`/api/v1/admin/users/${userId}`),
      apiGet<AdminData>("/api/v1/admin/users"),
    ]);
    const nextForm = formFromUser(detail.user);
    setUser(detail.user);
    setAudits(detail.audits);
    setRefs(admin);
    setForm(nextForm);
    setBaseline(nextForm);
    setFieldErrors({});
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    void (async () => {
      try {
        const me = await apiGet<{ user: User }>("/api/v1/me");
        if (!me.user.permissionCodes.includes("admin.users")) {
          router.replace("/access-denied");
          return;
        }
        await load();
      } catch (err) {
        setError(friendlyError(err, "Unable to load user."));
      }
    })();
  }, [userId, router, load]);

  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const availableCostCenters = useMemo(
    () =>
      (refs?.costCenters ?? []).filter(
        (center) =>
          center.departmentId === form?.departmentId && center.isActive
      ),
    [refs, form?.departmentId]
  );

  const managerOptions = useMemo(
    () =>
      (refs?.users ?? []).filter(
        (candidate) => candidate.active && candidate.id !== userId
      ),
    [refs, userId]
  );

  const passwordResets = useMemo(
    () =>
      audits
        .filter((entry) => entry.action === "UserPasswordReset")
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [audits]
  );

  const createdAt = useMemo(() => {
    const created = audits
      .filter((entry) => entry.action === "UserCreated")
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))[0];
    return created ? new Date(created.timestamp).toLocaleString() : "Not recorded";
  }, [audits]);

  function selectSection(next: SectionId) {
    setSection(next);
    router.replace(`/admin/users/${userId}?section=${next}`, { scroll: false });
  }

  function changeDepartment(departmentId: string) {
    const firstCenter = refs?.costCenters.find(
      (center) => center.departmentId === departmentId && center.isActive
    );
    setForm((current) =>
      current
        ? {
            ...current,
            departmentId,
            primaryCostCenterId: firstCenter?.id ?? "",
          }
        : current
    );
  }

  function toggleRole(code: string) {
    setForm((current) => {
      if (!current) return current;
      const roleCodes = current.roleCodes.includes(code)
        ? current.roleCodes.filter((role) => role !== code)
        : [...current.roleCodes, code];
      return { ...current, roleCodes };
    });
  }

  function requestCancel() {
    if (dirty) {
      setDiscardOpen(true);
      return;
    }
    router.push("/admin");
  }

  async function saveChanges(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    setFieldErrors({});
    try {
      const updated = await apiSend<User>(
        `/api/v1/admin/users/${userId}`,
        "PATCH",
        {
          name: form.name,
          email: form.email,
          positionId: form.positionId,
          managerId: form.managerId || null,
          departmentId: form.departmentId,
          primaryCostCenterId: form.primaryCostCenterId,
          roleCodes: form.roleCodes,
          active: form.active,
        }
      );
      const nextForm = formFromUser(updated);
      setUser(updated);
      setForm(nextForm);
      setBaseline(nextForm);
      setNotice("User updated successfully.");
      const auditAction =
        !user.active && updated.active
          ? "UserActivated"
          : user.active && !updated.active
            ? "UserDeactivated"
            : "UserUpdated";
      setAudits((current) => [
        {
          id: crypto.randomUUID(),
          entity: "User",
          entityId: userId,
          action: auditAction,
          performedBy: "",
          ipAddress: null,
          correlationId: "",
          beforeJson: null,
          afterJson: null,
          timestamp: new Date().toISOString(),
        },
        ...current,
      ]);
    } catch (err) {
      if (err instanceof ApiError && err.code === "DUPLICATE_EMAIL") {
        setFieldErrors({ email: err.message });
      } else if (err instanceof ApiError && err.code === "INVALID_HIERARCHY") {
        setFieldErrors({ managerId: err.message });
      } else if (err instanceof ApiError && err.code === "INVALID_REFERENCE") {
        setFieldErrors({
          primaryCostCenterId: err.message,
          departmentId: err.message,
        });
      } else if (err instanceof ApiError && err.code === "INVALID_ROLE") {
        setFieldErrors({ roleCodes: err.message });
      }
      setError(friendlyError(err, "Unable to save changes."));
    } finally {
      setBusy(false);
    }
  }

  async function confirmReset() {
    if (resetPassword.trim().length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setActionBusy(true);
    setError(null);
    try {
      await apiSend(`/api/v1/admin/users/${userId}/reset-password`, "POST", {
        password: resetPassword,
      });
      setResetResult(resetPassword);
      setNotice("Password reset successfully.");
      setAudits((current) => [
        {
          id: crypto.randomUUID(),
          entity: "User",
          entityId: userId,
          action: "UserPasswordReset",
          performedBy: "",
          ipAddress: null,
          correlationId: "",
          beforeJson: null,
          afterJson: null,
          timestamp: new Date().toISOString(),
        },
        ...current,
      ]);
    } catch (err) {
      setError(friendlyError(err, "Unable to reset password."));
      setResetOpen(false);
      setResetPassword("");
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

  if (error && !user) {
    return (
      <PageShell>
        <p className="text-kengen-red">{error}</p>
        <ActionLink href="/admin" variant="secondary" className="mt-3">
          Back to Users
        </ActionLink>
      </PageShell>
    );
  }

  if (!user || !form || !refs) {
    return (
      <PageShell>
        <p className="text-meta">Loading user profile…</p>
      </PageShell>
    );
  }

  const selectClass = "glass-select mt-1 w-full";
  const position = refs.positions.find((item) => item.id === user.positionId);

  return (
    <PageShell>
      <PageHeader
        title={user.name}
        description={user.email}
        actions={
          <ActionLink href="/admin" variant="secondary" size="compact">
            Back to Users
          </ActionLink>
        }
      />

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

      <nav className="mb-5 flex flex-wrap gap-1 border-b border-neutral-400/30">
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => selectSection(item.id)}
            className={
              "rounded-t px-4 py-2 text-body transition " +
              (section === item.id
                ? "border-b-2 border-kengen-green font-medium text-kengen-navy"
                : "text-neutral-600 hover:text-kengen-navy")
            }
          >
            {item.label}
          </button>
        ))}
      </nav>

      <form onSubmit={saveChanges} className="space-y-5">
        {section === "profile" ? (
          <section className="rounded border border-neutral-400/30 bg-white p-4">
            <h2 className="font-medium text-kengen-navy">Personal Details</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <TextField
                label="Full name"
                value={form.name}
                onChange={(name) =>
                  setForm((current) =>
                    current ? { ...current, name } : current
                  )
                }
                required
              />
              <div>
                <TextField
                  label="KenGen email"
                  type="email"
                  value={form.email}
                  onChange={(email) =>
                    setForm((current) =>
                      current ? { ...current, email } : current
                    )
                  }
                  required
                />
                {fieldErrors.email ? (
                  <p className="mt-1 text-meta text-kengen-red">
                    {fieldErrors.email}
                  </p>
                ) : null}
              </div>
              <div>
                <p className="text-meta text-neutral-600">User ID</p>
                <p className="mt-1 font-mono text-body text-neutral-700">
                  {user.id}
                </p>
              </div>
              <div>
                <p className="text-meta text-neutral-600">Position (display)</p>
                <p className="mt-1 text-body">{position?.title ?? "—"}</p>
              </div>
            </div>
          </section>
        ) : null}

        {section === "organization" ? (
          <section className="rounded border border-neutral-400/30 bg-white p-4">
            <h2 className="font-medium text-kengen-navy">Organization</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="block text-meta">
                Position
                <select
                  className={selectClass}
                  value={form.positionId}
                  onChange={(event) =>
                    setForm((current) =>
                      current
                        ? { ...current, positionId: event.target.value }
                        : current
                    )
                  }
                  required
                >
                  {refs.positions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
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
                  {refs.departments.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.departmentId ? (
                  <p className="mt-1 text-meta text-kengen-red">
                    {fieldErrors.departmentId}
                  </p>
                ) : null}
              </label>
              <label className="block text-meta">
                Cost centre
                <select
                  className={selectClass}
                  value={form.primaryCostCenterId}
                  onChange={(event) =>
                    setForm((current) =>
                      current
                        ? {
                            ...current,
                            primaryCostCenterId: event.target.value,
                          }
                        : current
                    )
                  }
                  required
                >
                  {availableCostCenters.map((center) => (
                    <option key={center.id} value={center.id}>
                      {center.code} — {center.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.primaryCostCenterId ? (
                  <p className="mt-1 text-meta text-kengen-red">
                    {fieldErrors.primaryCostCenterId}
                  </p>
                ) : null}
              </label>
              <label className="block text-meta">
                Reporting manager
                <select
                  className={selectClass}
                  value={form.managerId}
                  onChange={(event) =>
                    setForm((current) =>
                      current
                        ? { ...current, managerId: event.target.value }
                        : current
                    )
                  }
                >
                  <option value="">No manager (organization root)</option>
                  {managerOptions.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.managerId ? (
                  <p className="mt-1 text-meta text-kengen-red">
                    {fieldErrors.managerId}
                  </p>
                ) : null}
              </label>
            </div>
          </section>
        ) : null}

        {section === "roles" ? (
          <section className="rounded border border-neutral-400/30 bg-white p-4">
            <h2 className="font-medium text-kengen-navy">Roles & Permissions</h2>
            <fieldset className="mt-3">
              <legend className="sr-only">Roles</legend>
              <div className="flex flex-wrap gap-2">
                {refs.roles.map((role) => (
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
              {fieldErrors.roleCodes ? (
                <p className="mt-2 text-meta text-kengen-red">
                  {fieldErrors.roleCodes}
                </p>
              ) : null}
            </fieldset>
            <div className="mt-4">
              <p className="text-meta text-neutral-600">Effective permissions</p>
              <p className="mt-1 text-body text-neutral-700">
                {user.permissionCodes.join(", ") || "—"}
              </p>
            </div>
          </section>
        ) : null}

        {section === "account" ? (
          <section className="rounded border border-neutral-400/30 bg-white p-4">
            <h2 className="font-medium text-kengen-navy">Account</h2>
            <dl className="mt-3 grid gap-3 md:grid-cols-2 text-body">
              <div>
                <dt className="text-meta text-neutral-600">Status</dt>
                <dd className={form.active ? "text-kengen-green" : ""}>
                  {form.active ? "Active" : "Inactive"}
                </dd>
              </div>
              <div>
                <dt className="text-meta text-neutral-600">Created</dt>
                <dd>{createdAt}</dd>
              </div>
              <div>
                <dt className="text-meta text-neutral-600">Last login</dt>
                <dd className="text-neutral-600">Not recorded</dd>
              </div>
              <div>
                <dt className="text-meta text-neutral-600">
                  Password last reset
                </dt>
                <dd>
                  {passwordResets[0]
                    ? new Date(passwordResets[0].timestamp).toLocaleString()
                    : "Never recorded"}
                </dd>
              </div>
            </dl>
            <label className="mt-4 flex items-center gap-2 text-body">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) =>
                  setForm((current) =>
                    current
                      ? { ...current, active: event.target.checked }
                      : current
                  )
                }
              />
              Account active
            </label>
          </section>
        ) : null}

        {section === "security" ? (
          <section className="rounded border border-neutral-400/30 bg-white p-4">
            <h2 className="font-medium text-kengen-navy">Security</h2>
            <dl className="mt-3 grid gap-3 md:grid-cols-2 text-body">
              <div>
                <dt className="text-meta text-neutral-600">
                  Last password reset
                </dt>
                <dd>
                  {passwordResets[0]
                    ? new Date(passwordResets[0].timestamp).toLocaleString()
                    : "Never recorded"}
                </dd>
              </div>
              <div>
                <dt className="text-meta text-neutral-600">Last login</dt>
                <dd className="text-neutral-600">Not recorded</dd>
              </div>
              <div>
                <dt className="text-meta text-neutral-600">
                  Failed login attempts
                </dt>
                <dd className="text-neutral-600">Not recorded</dd>
              </div>
              <div>
                <dt className="text-meta text-neutral-600">
                  Password after admin reset
                </dt>
                <dd>
                  Permanent — the user can sign in with the new password
                  immediately. No forced change at next login.
                </dd>
              </div>
            </dl>
            <div className="mt-4">
              <Button
                type="button"
                variant="secondary"
                size="compact"
                disabled={!user.active || actionBusy || dirty}
                title={
                  dirty
                    ? "Save or discard edits before resetting the password"
                    : !user.active
                      ? "Reactivate the account before resetting its password"
                      : undefined
                }
                onClick={() => {
                  setResetOpen(true);
                  setResetPassword("");
                  setResetResult(null);
                }}
              >
                Reset Password
              </Button>
            </div>
          </section>
        ) : null}

        {section === "audit" ? (
          <section className="rounded border border-neutral-400/30 bg-white p-4">
            <h2 className="font-medium text-kengen-navy">Audit History</h2>
            {audits.length === 0 ? (
              <p className="mt-3 text-meta text-neutral-600">
                No audit events for this user yet.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-body">
                  <thead className="bg-neutral-100 text-meta uppercase text-neutral-700">
                    <tr>
                      <th className="px-3 py-2">When</th>
                      <th className="px-3 py-2">Action</th>
                      <th className="px-3 py-2">Correlation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...audits]
                      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
                      .map((entry) => (
                        <tr
                          key={entry.id}
                          className="border-t border-neutral-400/20"
                        >
                          <td className="px-3 py-2 text-meta">
                            {new Date(entry.timestamp).toLocaleString()}
                          </td>
                          <td className="px-3 py-2">{entry.action}</td>
                          <td className="px-3 py-2 font-mono text-meta">
                            {entry.correlationId}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : null}

        {section !== "audit" ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              variant="primary"
              loading={busy}
              loadingLabel="Saving…"
              disabled={!dirty}
            >
              Save Changes
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={requestCancel}
            >
              Cancel
            </Button>
          </div>
        ) : null}
      </form>

      <ConfirmDialog
        open={discardOpen}
        title="Discard changes?"
        confirmLabel="Discard"
        confirmVariant="danger"
        cancelLabel="Keep Editing"
        onCancel={() => setDiscardOpen(false)}
        onConfirm={() => {
          setDiscardOpen(false);
          router.push("/admin");
        }}
      >
        <p>Your edits have not been saved.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={resetOpen && !resetResult}
        title="Reset password?"
        confirmLabel="Reset Password"
        busy={actionBusy}
        loadingLabel="Resetting…"
        confirmDisabled={resetPassword.trim().length < 8}
        onCancel={() => {
          if (!actionBusy) {
            setResetOpen(false);
            setResetPassword("");
          }
        }}
        onConfirm={() => void confirmReset()}
      >
        <p className="mb-3">
          Enter a new password for this user. It becomes their permanent
          sign-in password immediately.
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
        onCancel={() => {
          setResetOpen(false);
          setResetPassword("");
          setResetResult(null);
        }}
        onConfirm={() => {
          setResetOpen(false);
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
    </PageShell>
  );
}
