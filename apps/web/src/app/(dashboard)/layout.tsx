"use client";

import { AuthProvider } from "@/context/AuthContext";
import { AccountProvider, useAccount } from "@/context/AccountContext";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { ProfileGate } from "@/components/auth/ProfileGate";
import { ProfileLoadingModal } from "@/components/layout/ProfileLoadingModal";

function DashboardInnerLayout({ children }: { children: React.ReactNode }) {
  const { activeHandle, activePlatform, ingestHandleOrUrl, isLoading } = useAccount();

  return (
    <ProfileGate>
      <div className="flex min-h-screen bg-[#FBFBFB]">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar
            activeHandle={activeHandle}
            activePlatform={activePlatform}
            onAnalyzeHandle={ingestHandleOrUrl}
            isAnalyzing={isLoading}
          />
          <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
            {children}
          </main>
        </div>
      </div>
      <ProfileLoadingModal isOpen={isLoading} handle={activeHandle} />
    </ProfileGate>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <AccountProvider>
        <DashboardInnerLayout>{children}</DashboardInnerLayout>
      </AccountProvider>
    </AuthProvider>
  );
}

