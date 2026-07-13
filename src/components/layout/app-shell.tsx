"use client";

import { useEffect, useState } from "react";
import type { Position, User } from "@/domain/entities";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { Footer } from "./footer";
import { repos } from "@/infrastructure/di";
import { mockStore } from "@/infrastructure/repositories/mock/store";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const allUsers = await repos.users.getAll();
        const current =
          allUsers.find((u) => u.id === mockStore.currentUserId) ?? allUsers[0];
        const pos =
          mockStore.positions.find((p) => p.id === current.positionId) ?? null;
        const notifs = await repos.notifications.listByUser(current.id);
        setUser(current);
        setPosition(pos);
        setNotificationCount(notifs.filter((n) => !n.isRead).length);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load session");
      }
    })();
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
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
    <div className="flex min-h-screen flex-col">
      <Header
        user={user}
        position={position}
        notificationCount={notificationCount}
      />
      <div className="flex min-h-0 flex-1">
        <Sidebar user={user} />
        <main className="min-w-0 flex-1 overflow-auto p-4">{children}</main>
      </div>
      <Footer />
    </div>
  );
}
