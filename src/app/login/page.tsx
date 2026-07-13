"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { IDS, users } from "@/infrastructure/repositories/mock/seed";
import { setCurrentUserId } from "@/infrastructure/di";

/**
 * Staff sign in via corporate SSO (mocked).
 * System Administrator uses a separate local sign-in — not SSO.
 * After SSO, each user only sees their own permission-scoped dashboard.
 */
export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"staff" | "admin">("staff");
  const [ssoUserId, setSsoUserId] = useState(IDS.patrick);
  const [adminEmail, setAdminEmail] = useState("ict.admin@kengen.co.ke");
  const [adminPassword, setAdminPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const staffUsers = useMemo(
    () => users.filter((u) => !u.roleCodes.includes("SystemAdmin")),
    []
  );

  function signInWithSso(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const selected = staffUsers.find((u) => u.id === ssoUserId);
    if (!selected) {
      setError("Select your KenGen account to continue SSO.");
      return;
    }
    // Production: redirect to Azure AD / KenGen IdP, then land on /home
    setCurrentUserId(selected.id);
    router.push("/home");
  }

  function signInAdmin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (adminEmail.toLowerCase() !== "ict.admin@kengen.co.ke") {
      setError("Invalid administrator credentials.");
      return;
    }
    // Mock password check — any non-empty in demo
    if (!adminPassword.trim()) {
      setError("Enter administrator password.");
      return;
    }
    setCurrentUserId(IDS.admin);
    router.push("/admin");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-kengen-navy px-4">
      <div className="w-full max-w-sm rounded border border-white/10 bg-white p-6 shadow-xl">
        <div className="mb-4 text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded bg-kengen-green text-sm font-bold text-white">
            KG
          </div>
          <h1 className="text-base font-semibold text-kengen-navy">
            ICT Budgeting Portal
          </h1>
          <p className="text-meta text-neutral-700">
            {mode === "staff"
              ? "Staff sign in with KenGen SSO"
              : "System Administrator only"}
          </p>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-1 rounded border border-neutral-400/30 p-0.5 text-meta">
          <button
            type="button"
            className={`rounded px-2 py-1.5 ${
              mode === "staff"
                ? "bg-kengen-green font-medium text-white"
                : "text-neutral-700 hover:bg-neutral-100"
            }`}
            onClick={() => {
              setMode("staff");
              setError(null);
            }}
          >
            Staff (SSO)
          </button>
          <button
            type="button"
            className={`rounded px-2 py-1.5 ${
              mode === "admin"
                ? "bg-kengen-navy font-medium text-white"
                : "text-neutral-700 hover:bg-neutral-100"
            }`}
            onClick={() => {
              setMode("admin");
              setError(null);
            }}
          >
            Admin
          </button>
        </div>

        {error ? (
          <p className="mb-3 rounded border border-kengen-red/30 bg-red-50 px-2 py-1.5 text-meta text-kengen-red">
            {error}
          </p>
        ) : null}

        {mode === "staff" ? (
          <form onSubmit={signInWithSso}>
            <p className="mb-3 text-meta text-neutral-700">
              After SSO, you only see <strong>your</strong> dashboard — menus and
              data are scoped to your cost center and reporting line. You cannot
              switch to another user.
            </p>
            <label className="mb-3 block text-meta">
              Demo: choose staff identity (simulates SSO account)
              <select
                className="mt-1 w-full rounded border border-neutral-400/40 px-2 py-1.5 text-body"
                value={ssoUserId}
                onChange={(e) => setSsoUserId(e.target.value)}
              >
                {staffUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {u.email}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="w-full rounded bg-kengen-green py-2 text-body font-medium text-white hover:bg-kengen-green/90"
            >
              Sign in with KenGen SSO
            </button>
            <p className="mt-3 text-center text-meta text-neutral-700">
              Production uses Microsoft / AD SSO — no password on this screen.
            </p>
          </form>
        ) : (
          <form onSubmit={signInAdmin}>
            <p className="mb-3 text-meta text-neutral-700">
              Administrators manage users and cost-center assignments. This is
              separate from staff SSO.
            </p>
            <label className="mb-3 block text-meta">
              Admin email
              <input
                className="mt-1 w-full rounded border border-neutral-400/40 px-2 py-1.5 text-body"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                required
              />
            </label>
            <label className="mb-4 block text-meta">
              Password
              <input
                type="password"
                className="mt-1 w-full rounded border border-neutral-400/40 px-2 py-1.5 text-body"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                required
              />
            </label>
            <button
              type="submit"
              className="w-full rounded bg-kengen-navy py-2 text-body font-medium text-white hover:bg-kengen-navy/90"
            >
              Admin sign in
            </button>
            <p className="mt-3 text-center text-meta text-neutral-700">
              Demo: ict.admin@kengen.co.ke / any password
            </p>
          </form>
        )}
      </div>
      <p className="mt-4 text-meta text-white/70">
        Internal — KenGen Confidential
      </p>
    </div>
  );
}
