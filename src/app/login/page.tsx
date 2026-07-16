"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { FormAlert } from "@/components/auth/form-alert";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { apiSend } from "@/lib/client-api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();
    if (!trimmedEmail || !trimmedPassword) {
      setError("Enter both email and password.");
      return;
    }
    setBusy(true);
    try {
      const data = await apiSend<{
        userId: string;
        isAdmin: boolean;
        isFinance?: boolean;
        redirectTo?: string;
      }>("/api/v1/auth/login", "POST", {
        email: trimmedEmail,
        password: trimmedPassword,
      });
      router.push(
        data.redirectTo ??
          (data.isAdmin ? "/admin" : data.isFinance ? "/finance" : "/home")
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="ICT Budgeting Portal">
      {error ? <FormAlert kind="error">{error}</FormAlert> : null}

      <form onSubmit={signIn} className="space-y-3">
        <TextField
          label="Work email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@kengen.co.ke"
          autoComplete="email"
          required
        />
        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          required
        />
        <Button type="submit" fullWidth loading={busy} variant="primary">
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}
