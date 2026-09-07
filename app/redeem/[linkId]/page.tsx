// app/redeem/[linkId]/page.tsx

"use client";

import { useSession, signIn } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { JoinOrgPrompt } from "@/components/redeem/JoinOrgPrompt";
import { TeamSelector } from "@/components/redeem/TeamSelector";
import { RedeemSuccess } from "@/components/redeem/RedeemSuccess";
import { SoloRedeemForm } from "@/components/redeem/SoloRedeemForm";

interface PageData {
  link: {
    id: number;
    link_id: string;
    assessment_name: string;
    link_type: "solo" | "group";
    access_level: string;
    max_team_size: number | null;
    org_name: string;
  };
  teams: Array<{
    id: number;
    team_name: string;
    memberCount?: number;
  }>;
  membership: "active" | "pending" | "none";
  existingRedemption?: {
    repoName: string;
    repoUrl: string;
    cloneUrl: string;
  };
}

function RedeemContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const linkId = params.linkId as string;

  const [pageData, setPageData] = useState<PageData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState<
    string | null
  >(null);
  const [success, setSuccess] = useState<{
    repoName: string;
    repoUrl: string;
    cloneUrl: string;
  } | null>(null);

  // Fetch page data on mount and when session changes
  useEffect(() => {
    async function fetchPageData() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/redeem/${linkId}`,
          {
            cache: "no-store",
            headers: {
              "Cache-Control": "no-cache, no-store, must-revalidate",
            },
          }
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(
            data.error || "Failed to load assignment"
          );
        }

        const data: PageData = await response.json();
        setPageData(data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load assignment"
        );
      } finally {
        setLoading(false);
      }
    }

    fetchPageData();
  }, [linkId, session]);

  // Handle solo redemption
  async function handleSoloRedeem(
    customSlug?: string
  ) {
    if (!pageData) return;

    setRedeeming(true);
    setRedeemError(null);

    try {
      const response = await fetch(
        `/api/redeem/${linkId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customSlug }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(
          data.error || "Failed to redeem link"
        );
      }

      const result = await response.json();
      setSuccess({
        repoName: result.repoName,
        repoUrl: result.repoUrl,
        cloneUrl: result.cloneUrl,
      });
    } catch (err) {
      setRedeemError(
        err instanceof Error
          ? err.message
          : "Failed to redeem link"
      );
    } finally {
      setRedeeming(false);
    }
  }

  // Handle group redemption - join existing team
  async function handleSelectTeam(teamId: number) {
    if (!pageData) return;

    setRedeeming(true);
    setRedeemError(null);

    try {
      const response = await fetch(
        `/api/redeem/${linkId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            teamId,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(
          data.error || "Failed to redeem link"
        );
      }

      const result = await response.json();
      setSuccess({
        repoName: result.repoName,
        repoUrl: result.repoUrl,
        cloneUrl: result.cloneUrl,
      });
    } catch (err) {
      setRedeemError(
        err instanceof Error
          ? err.message
          : "Failed to redeem link"
      );
    } finally {
      setRedeeming(false);
    }
  }

  // Handle group redemption - create new team
  async function handleCreateTeam(
    teamName: string,
    expectedSize: number
  ) {
    if (!pageData) return;

    setRedeeming(true);
    setRedeemError(null);

    try {
      const response = await fetch(
        `/api/redeem/${linkId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            newTeamName: teamName,
            expectedTeamSize: expectedSize,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(
          data.error || "Failed to redeem link"
        );
      }

      const result = await response.json();
      setSuccess({
        repoName: result.repoName,
        repoUrl: result.repoUrl,
        cloneUrl: result.cloneUrl,
      });
    } catch (err) {
      setRedeemError(
        err instanceof Error
          ? err.message
          : "Failed to redeem link"
      );
    } finally {
      setRedeeming(false);
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12
                          border-b-2 border-blue-600 mx-auto mb-4">
          </div>
          <p className="text-gray-600">
            Loading assignment...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !pageData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-red-600 mb-4">
            Error
          </h1>
          <p className="text-gray-600 mb-6">
            {error || "Assignment not found"}
          </p>
          <button
            onClick={() => router.push("/")}
            className="bg-blue-600 text-white px-6 py-2
                       rounded-lg hover:bg-blue-700 transition"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  // Unauthenticated state
  if (status === "unauthenticated") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold mb-4">
            {pageData.link.assessment_name}
          </h1>
          <p className="text-gray-600 mb-6">
            Sign in with GitHub to redeem this assignment.
          </p>
          <button
            onClick={() =>
              signIn("github", {
                callbackUrl: `/redeem/${linkId}`,
              })
            }
            className="bg-black text-white px-6 py-3
                       rounded-lg hover:bg-gray-800 transition
                       font-medium"
          >
            Sign in with GitHub
          </button>
        </div>
      </div>
    );
  }

  // Authenticated but not org member
  if (pageData.membership !== "active") {
    return (
      <JoinOrgPrompt
        linkId={linkId}
        orgName={pageData.link.org_name}
        membership={pageData.membership}
        onContinue={() => {
          // Re-fetch page data to check membership
          setLoading(true);
        }}
      />
    );
  }

  // Already redeemed
  if (pageData.existingRedemption) {
    return (
      <RedeemSuccess
        repoName={pageData.existingRedemption.repoName}
        repoUrl={pageData.existingRedemption.repoUrl}
        cloneUrl={pageData.existingRedemption.cloneUrl}
        alreadyRedeemed={true}
      />
    );
  }

  // Success state
  if (success) {
    return (
      <RedeemSuccess
        repoName={success.repoName}
        repoUrl={success.repoUrl}
        cloneUrl={success.cloneUrl}
        alreadyRedeemed={false}
      />
    );
  }

  // Redemption form
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">
            Student Repo Manager
          </h1>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-2xl font-bold mb-2">
            {pageData.link.assessment_name}
          </h2>
          <p className="text-gray-600">
            {pageData.link.link_type === "solo"
              ? "Individual Assignment"
              : "Group Assignment"}
          </p>
        </div>

        {redeemError && (
          <div className="mb-6 p-4 bg-red-50 border
                          border-red-200 rounded text-red-700">
            {redeemError}
          </div>
        )}

        {pageData.link.link_type === "solo" ? (
          <SoloRedeemForm
            onSubmit={handleSoloRedeem}
            loading={redeeming}
          />
        ) : (
          <TeamSelector
            teams={pageData.teams}
            maxTeamSize={pageData.link.max_team_size}
            onSelectTeam={handleSelectTeam}
            onCreateTeam={handleCreateTeam}
            loading={redeeming}
          />
        )}
      </main>
    </div>
  );
}

export default function RedeemPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12
                            border-b-2 border-blue-600 mx-auto mb-4">
            </div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <RedeemContent />
    </Suspense>
  );
}
