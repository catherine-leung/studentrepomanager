"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { OrganizationSelector } from "@/components/OrganizationSelector";
import { OrgSecurityBanner } from "@/components/OrgSecurityBanner";
import { LinkCreationForm } from "@/components/LinkCreationForm";
import { LinksList } from "@/components/LinksList";
import { COPY } from "@/lib/copy";

function getAppSlug(): string {
  return (
    process.env.NEXT_PUBLIC_GITHUB_APP_SLUG ||
    "student-repo-manager"
  );
}

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

  const appSlug = getAppSlug();
  const installUrl =
    `https://github.com/apps/${appSlug}/installations/new`;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg
                              flex items-center justify-center">
                <span className="text-white font-bold">RM</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">
                {COPY.appName}
              </h1>
            </div>

            <div className="flex items-center gap-4">
              <a
                href={installUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-green-600 text-white
                           rounded-lg hover:bg-green-700
                           transition text-sm font-medium"
              >
                {COPY.nav.addOrganization}
              </a>

              <div className="flex items-center gap-3 pl-4
                              border-l border-gray-200">
                <img
                  src={session.user?.image || ""}
                  alt="Avatar"
                  className="w-8 h-8 rounded-full"
                />
                <span className="text-sm text-gray-700">
                  {session.user?.login}
                </span>
                <button
                  onClick={() => signOut()}
                  className="text-sm text-gray-600
                             hover:text-gray-900"
                >
                  {COPY.nav.signOut}
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
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
