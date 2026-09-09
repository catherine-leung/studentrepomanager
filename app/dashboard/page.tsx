// app/dashboard/page.tsx

"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { OrganizationSelector } from "@/components/OrganizationSelector";
import { OrgSecurityBanner } from "@/components/OrgSecurityBanner";
import { LinkCreationForm } from "@/components/LinkCreationForm";
import { LinksList } from "@/components/LinksList";

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [selectedOrg, setSelectedOrg] = useState<
    string | null
  >(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex
                        justify-between items-center">
          <h1 className="text-2xl font-bold">
            Student Repo Manager
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-600">
              {session.user?.login}
            </span>
            <button
              onClick={() => signOut()}
              className="bg-red-500 text-white px-4 py-2
                         rounded hover:bg-red-600 transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <OrganizationSelector
          onSelect={setSelectedOrg}
          selectedOrg={selectedOrg}
        />

        {selectedOrg && (
          <>
            <OrgSecurityBanner orgName={selectedOrg} />
            <LinkCreationForm
              orgName={selectedOrg}
              onSuccess={() =>
                setRefreshTrigger((t) => t + 1)
              }
            />
            <LinksList
              orgName={selectedOrg}
              refreshTrigger={refreshTrigger}
            />
          </>
        )}
      </main>
    </div>
  );
}
