// app/redeem/[linkId]/page.tsx

"use client";

import { useSession, signIn } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { JoinOrgPrompt } from "@/components/redeem/JoinOrgPrompt";
import { AccountMismatchNotice } from "@/components/redeem/AccountMismatchNotice";
import { TeamSelector } from "@/components/redeem/TeamSelector";
import { RedeemSuccess } from "@/components/redeem/RedeemSuccess";
import { RedeemNav } from "@/components/redeem/RedeemNav";
import { SoloRedeemForm } from "@/components/redeem/SoloRedeemForm";
import { CoursedocsRedeemForm } from "@/components/redeem/CoursedocsRedeemForm";
import { GitHubMark } from "@/components/ui/GitHubMark";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

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
  accountMismatch:
    | "needs_personal_account"
    | "needs_enterprise_account"
    | null;
  existingRedemption?: RedemptionSummary;
}

interface RedemptionSummary {
  repoName: string;
  repoUrl: string;
  cloneUrl: string;
}

const TYPE_LABELS = {
  solo: "Individual Repository",
  group: "Group Repository",
  coursedocs: "Course Documents (shared, read-only)",
} as const;

const TYPE_BADGE_COLOR = {
  solo: "blue",
  group: "purple",
  coursedocs: "gray",
} as const;

function Spinner({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center
                    justify-center bg-canvas">
      <div className="text-center" role="status">
        <div
          aria-hidden="true"
          className="mx-auto mb-4 h-10 w-10 animate-spin
                     rounded-full border-2 border-primary-200
                     border-t-primary-600"
        />
        <p className="text-sm text-neutral-500">{message}</p>
      </div>
    </div>
  );
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
            data.error || "Failed to load link"
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
              : "Failed to load link"
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
    return <Spinner message="Loading link..." />;
  }

  if (error || !pageData) {
    return (
      <div className="flex min-h-screen items-center
                      justify-center bg-canvas px-4">
        <div className="w-full max-w-md rounded-xl border
                        border-neutral-200 bg-white p-8
                        text-center shadow-sm">
          <h1 className="mb-2 text-xl font-bold text-error">
            Error
          </h1>
          <p className="mb-6 text-sm text-neutral-600">
            {error || "Link not found"}
          </p>
          <Button
            variant="primary"
            onClick={() => router.push("/")}
          >
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="flex min-h-screen items-center
                      justify-center bg-canvas px-4">
        <div className="w-full max-w-md rounded-xl border
                        border-primary-100 bg-white p-8
                        text-center shadow-md">
          <h1 className="mb-2 text-xl font-bold
                        text-neutral-900">
            {pageData.link.assessment_name}
          </h1>
          <p className="mb-6 text-sm text-neutral-600">
            Sign in with GitHub to redeem this link.
          </p>
          <Button
            variant="primary"
            size="lg"
            className="w-full bg-neutral-900
                       hover:bg-neutral-800"
            onClick={() =>
              signIn("github", {
                callbackUrl: `/redeem/${linkId}`,
              })
            }
          >
            <GitHubMark className="h-5 w-5" />
            Sign in with GitHub
          </Button>
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
    ? "This link has been deactivated."
    : isExpired
      ? "This link has expired."
      : null;

  if (unavailableReason) {
    return (
      <div className="flex min-h-screen items-center
                      justify-center bg-canvas px-4">
        <div className="w-full max-w-md rounded-xl border
                        border-neutral-200 bg-white p-8
                        text-center shadow-sm">
          <h1 className="mb-2 text-xl font-bold
                        text-neutral-900">
            {pageData.link.assessment_name}
          </h1>
          <p className="text-sm text-neutral-600">
            {unavailableReason} Please contact your
            instructor.
          </p>
        </div>
      </div>
    );
  }

  // A wrong-kind-of-account mismatch (personal vs. Enterprise
  // Managed User) is unfixable by joining the org, so it takes
  // priority over the normal join-org flow.
  if (pageData.accountMismatch) {
    return (
      <AccountMismatchNotice
        reason={pageData.accountMismatch}
        currentLogin={session?.user?.login ?? ""}
      />
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
    <div className="min-h-screen bg-canvas">
      <RedeemNav />

      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6 rounded-xl border
                        border-neutral-200 bg-white p-6
                        shadow-sm">
          <div className="mb-1 flex flex-wrap items-center
                          gap-2">
            <h1 className="text-xl font-bold
                          text-neutral-900">
              {pageData.link.assessment_name}
            </h1>
            <Badge color={TYPE_BADGE_COLOR[
              pageData.link.link_type
            ]}>
              {TYPE_LABELS[pageData.link.link_type]
                .split(" (")[0]}
            </Badge>
          </div>
          <p className="text-sm text-neutral-500">
            {pageData.link.org_name}
          </p>
        </div>

        {redeemError && (
          <div className="mb-6">
            <Alert type="error" message={redeemError} />
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
