"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Position, User } from "@/domain/entities";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { Footer } from "./footer";
import { apiGet, ApiError } from "@/lib/client-api";
import { canAccessPath } from "@/lib/portal-access";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const [developmentToolkitEnabled, setDevelopmentToolkitEnabled] =
    useState(false);
  const [error, setError] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    async function loadSession() {
      try {
        const data = await apiGet<{
          user: User;
          position: Position | null;
          unreadNotifications: number;
          developmentToolkitEnabled?: boolean;
        }>("/api/v1/me");
        const toolkitOn = Boolean(data.developmentToolkitEnabled);
        if (
          !canAccessPath(pathname ?? "/", data.user, {
            developmentToolkitEnabled: toolkitOn,
          })
        ) {
          router.replace("/access-denied");
          return;
        }
        setUser(data.user);
        setPosition(data.position);
        setNotificationCount(data.unreadNotifications);
        setDevelopmentToolkitEnabled(toolkitOn);
        setError(null);
      } catch (e) {
        const status = e instanceof ApiError ? e.status : 0;
        const message = e instanceof Error ? e.message : "Failed to load session";
        // Stale / orphaned session cookie — send them to login instead of a dead portal page.
        if (
          status === 401 ||
          message.includes("Not signed in") ||
          message.includes("Current user not found")
        ) {
          router.replace("/login");
          return;
        }
        setError(message);
      }
    }

    void loadSession();
    function onFocus() {
      void loadSession();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [pathname, router]);

  useEffect(() => {
    if (!navOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [navOpen]);

  useEffect(() => {
    function onResize() {
      if (window.matchMedia("(min-width: 768px)").matches) {
        setNavOpen(false);
      }
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 sm:p-6">
        <p className="text-kengen-red">{error}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-meta text-neutral-700">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden">
      <Header
        user={user}
        position={position}
        notificationCount={notificationCount}
        navOpen={navOpen}
        onMenuClick={() => setNavOpen((v) => !v)}
      />
      <div className="relative flex min-h-0 flex-1">
        {navOpen ? (
          <button
            type="button"
            aria-label="Close navigation"
            className="fixed inset-x-0 bottom-0 top-12 z-40 bg-kengen-navy/40 md:hidden"
            onClick={() => setNavOpen(false)}
          />
        ) : null}
        <Sidebar
          user={user}
          mobileOpen={navOpen}
          onNavigate={() => setNavOpen(false)}
          developmentToolkitEnabled={developmentToolkitEnabled}
        />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto p-3 sm:p-4">
          <div className="flex min-h-full flex-1 flex-col">{children}</div>
        </main>
      </div>
      <Footer />
    </div>
  );
}
