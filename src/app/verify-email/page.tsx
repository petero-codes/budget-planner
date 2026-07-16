"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui/button";
import { apiSend } from "@/lib/client-api";

type Status = "verifying" | "success" | "error";

function VerifyEmailBody() {
  const searchParams = useSearchParams();
  const token = searchParams?.get("token") ?? "";
  const [status, setStatus] = useState<Status>(token ? "verifying" : "error");
  const [message, setMessage] = useState(
    token ? "Verifying your email…" : "This verification link is incomplete."
  );
  const requested = useRef(false);

  useEffect(() => {
    if (!token || requested.current) return;
    requested.current = true;
    void (async () => {
      try {
        const data = await apiSend<{ message: string }>(
          "/api/v1/auth/verify-email",
          "POST",
          { token }
        );
        setStatus("success");
        setMessage(data.message);
      } catch (err) {
        setStatus("error");
        setMessage(
          err instanceof Error ? err.message : "Verification failed."
        );
      }
    })();
  }, [token]);

  return (
    <>
      {status === "verifying" ? (
        <FormAlert kind="info">{message}</FormAlert>
      ) : (
        <FormAlert kind={status === "success" ? "success" : "error"}>
          {message}
        </FormAlert>
      )}
      {status === "success" ? (
        <Link href="/login">
          <Button type="button" variant="primary" fullWidth>
            Continue to sign in
          </Button>
        </Link>
      ) : status === "error" ? (
        <Link href="/login">
          <Button type="button" variant="secondary" fullWidth>
            Back to sign in
          </Button>
        </Link>
      ) : null}
    </>
  );
}

export default function VerifyEmailPage() {
  return (
    <AuthShell title="Email verification">
      <Suspense fallback={<p className="text-meta text-neutral-700">Loading…</p>}>
        <VerifyEmailBody />
      </Suspense>
    </AuthShell>
  );
}
