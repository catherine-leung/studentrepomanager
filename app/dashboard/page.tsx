// app/dashboard/page.tsx

"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { markAddOrganizationClicked } from "@/lib/org-welcome-tracker";
import { OrgWelcomeNote } from "@/components/OrgWelcomeNote";
import { OrganizationSelector } from
  "@/components/OrganizationSelector";
import { OrgSecurityBanner } from
  "@/components/OrgSecurityBanner";
import { LinkCreationForm } from
  "@/components/LinkCreationForm";
import { LinksList } from "@/components/LinksList";

function getAppSlug(): string {
  return (
    process.env.NEXT_PUBLIC_GITHUB_APP_SLUG ||
    "student-repo-manager"
  );
}

function DashboardLoading() {
  return (
    <div
      className="flex min-h-screen items-center justify-center
                 bg-canvas"
    >
      <div className="text-center" role="status">
        <div
          aria-hidden="true"
          className="mx-auto mb-4 h-8 w-8 animate-spin
                     rounded-full border-2 border-primary-200
                     border-t-primary-600"
        />
        <p className="text-neutral-600">Loading…</p>
      </div>
    </div>
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
    return <DashboardLoading />;
  }

  if (!session) {
    return null;
  }

  const appSlug = getAppSlug();
  const installUrl =
    `https://github.com/apps/${appSlug}/installations/new`;

  return (
    <div className="min-h-screen bg-canvas">
      <Header
        userLogin={session.user?.login}
        userImage={session.user?.image}
        onAddOrganization={() => {
          markAddOrganizationClicked();
          window.open(installUrl, "_blank");
        }}
      />

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Visually hidden: the Header brand mark already gives
            the page its visible identity, but screen readers
            still need exactly one real page-level heading to
            land on. */}
        <h1 className="sr-only">Dashboard</h1>

        <OrganizationSelector
          onSelect={setSelectedOrg}
          selectedOrg={selectedOrg}
        />

        {selectedOrg && (
          <>
            <OrgWelcomeNote orgName={selectedOrg} />
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
