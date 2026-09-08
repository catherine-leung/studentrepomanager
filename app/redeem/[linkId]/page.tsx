// app/redeem/[linkId]/page.tsx

"use client";

import { useSession, signIn } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { JoinOrgPrompt } from "@/components/redeem/JoinOrgPrompt";
import { TeamSelector } from "@/components/redeem/TeamSelector";
import { RedeemSuccess } from "@/components/redeem/RedeemSuccess";
import { SoloRedeemForm } from "@/components/redeem/SoloRedeemForm";
import { CoursedocsRedeemForm } from "@/components/redeem/CoursedocsRedeemForm";

interface PageData {
  link: {
    id: number;
    link_id: string;
    assessment_name: string;
    link_type: "solo" | "group" | "coursedocs";
    access_level: string;
    max_team_size: number | null;
    max_groups: number | null;
    current_groups: number;
    expires_at: string | null;
    is_active: boolean;
    org_name: string;
  };
  teams: Array<{
    id: number;
    team_name: string;
    expected_team_size: number;
    memberCount: number;
  }>;
  membership: "active" | "pending" | "none";
  existingRedemption?: RedemptionSummary;
}

interface RedemptionSummary {
  repoName: string;
  repoUrl: string;
  cloneUrl: string;
}

const TYPE_LABELS = {
  solo: "Individual Assignment",
  group: "Group Assignment",
  coursedocs: "Course Documents (shared, read-only)",
} as const;

function Spinner({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div
          className="animate-spin rounded-full h-12 w-12
                     border-b-2 border-blue-600 mx-auto mb-4"
        />
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  );
}

function RedeemContent() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams();
  const linkId = params.linkId as string;

  const [pageData, setPageData] = useState<PageData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [redeeming, setRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState<
    string | null
  >(null);
  const [success, setSuccess] =
    useState<RedemptionSummary | null>(null);

  // Fetch page data once the session status is known, and
  // again whenever refreshKey changes (e.g. after the student
  // accepts an org invitation and clicks "Continue").
  useEffect(() => {
    if (status === "loading") {
      return;
    }

    let cancelled = false;

    async function fetchPageData() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/redeem/${linkId}`,
          { cache: "no-store" }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || "Failed to load assignment"
          );
        }

        if (!cancelled) {
          setPageData(data as PageData);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load assignment"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchPageData();

    return () => {
      cancelled = true;
    };
  }, [linkId, status, refreshKey]);

  async function submitRedemption(
    body: Record<string, unknown>
  ) {
    setRedeeming(true);
    setRedeemError(null);

    try {
      const response = await fetch(
        `/api/redeem/${linkId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to redeem link"
        );
      }

      setSuccess({
        repoName: data.repoName,
        repoUrl: data.repoUrl,
        cloneUrl: data.cloneUrl,
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

  if (loading || status === "loading") {
    return <Spinner message="Loading assignment..." />;
  }

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

  // A student who already redeemed should always be able to
  // find their repo, even if the link has since been closed.
  if (pageData.existingRedemption) {
    return (
      <RedeemSuccess
        repoName={pageData.existingRedemption.repoName}
        repoUrl={pageData.existingRedemption.repoUrl}
        cloneUrl={pageData.existingRedemption.cloneUrl}
        alreadyRedeemed={true}
        linkType={pageData.link.link_type}
      />
    );
  }

  if (success) {
    return (
      <RedeemSuccess
        repoName={success.repoName}
        repoUrl={success.repoUrl}
        cloneUrl={success.cloneUrl}
        alreadyRedeemed={false}
        linkType={pageData.link.link_type}
      />
    );
  }

  const isExpired =
    pageData.link.expires_at !== null &&
    new Date(pageData.link.expires_at) < new Date();

  const unavailableReason = !pageData.link.is_active
    ? "This assignment link has been deactivated."
    : isExpired
      ? "This assignment link has expired."
      : null;

  if (unavailableReason) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold mb-4">
            {pageData.link.assessment_name}
          </h1>
          <p className="text-gray-600">
            {unavailableReason} Please contact your
            instructor.
          </p>
        </div>
      </div>
    );
  }

  if (pageData.membership !== "active") {
    return (
      <JoinOrgPrompt
        linkId={linkId}
        orgName={pageData.link.org_name}
        membership={pageData.membership}
        onContinue={() => setRefreshKey((k) => k + 1)}
      />
    );
  }

  // A null max_groups means "no limit" (legacy links created
  // before the field existed). The server enforces this too.
  const canCreateTeam =
    pageData.link.max_groups === null ||
    pageData.link.current_groups < pageData.link.max_groups;

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
            {TYPE_LABELS[pageData.link.link_type]}
          </p>
        </div>

        {redeemError && (
          <div
            className="mb-6 p-4 bg-red-50 border
                       border-red-200 rounded text-red-700"
          >
            {redeemError}
          </div>
        )}

        {pageData.link.link_type === "solo" ? (
          <SoloRedeemForm
            assessmentName={pageData.link.assessment_name}
            onSubmit={(customSlug) =>
              submitRedemption({ customSlug })
            }
            loading={redeeming}
          />
        ) : pageData.link.link_type === "coursedocs" ? (
          <CoursedocsRedeemForm
            repoName={pageData.link.assessment_name}
            onSubmit={() => submitRedemption({})}
            loading={redeeming}
          />
        ) : (
          <TeamSelector
            teams={pageData.teams}
            maxTeamSize={pageData.link.max_team_size}
            canCreateTeam={canCreateTeam}
            onSelectTeam={(teamId) =>
              submitRedemption({ teamId })
            }
            onCreateTeam={(teamName, expectedSize) =>
              submitRedemption({
                newTeamName: teamName,
                expectedTeamSize: expectedSize,
              })
            }
            loading={redeeming}
          />
        )}
      </main>
    </div>
  );
}

export default function RedeemPage() {
  return (
    <Suspense fallback={<Spinner message="Loading..." />}>
      <RedeemContent />
    </Suspense>
  );
}
