"use client";

import { Header } from "@/components/Header";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      <Header />
      {children}
    </div>
  );
}
