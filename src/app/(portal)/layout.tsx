import { AppShell } from "@/components/layout/app-shell";

/** Authenticated portal — never statically prerender (session + client shell). */
export const dynamic = "force-dynamic";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
