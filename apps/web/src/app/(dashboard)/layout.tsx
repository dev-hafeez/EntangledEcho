"use client";

import { AccountProvider, useAccount } from "@/context/AccountContext";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

function DashboardInnerLayout({ children }: { children: React.ReactNode }) {
  const { activeHandle, ingestHandleOrUrl, isLoading } = useAccount();

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          activeHandle={activeHandle}
          onAnalyzeHandle={ingestHandleOrUrl}
          isAnalyzing={isLoading}
        />
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AccountProvider>
      <DashboardInnerLayout>{children}</DashboardInnerLayout>
    </AccountProvider>
  );
}
