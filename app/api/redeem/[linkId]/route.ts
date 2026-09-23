// app/api/redeem/[linkId]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/session";
import {
  getRepoLinkByIdWithOrg,
  getStudentRedemption,
} from "@/lib/db";
import {
  getRedemptionPageData,
  redeemLink,
  LinkNotFoundError,
  LinkInactiveError,
  LinkExpiredError,
  NotOrgMemberError,
  AlreadyRedeemedError,
  TeamNotFoundError,
  TeamFullError,
  TeamNameTakenError,
  TeamNotReadyError,
  InvalidTeamChoiceError,
  RepoNameTakenError,
  MaxGroupsReachedError,
  InvalidRepoNameError,
} from "@/lib/redeem";
import { internalError } from "@/lib/api-errors";
import { slugify } from "@/lib/naming";

export const maxDuration = 60;

/**
 * Map typed redemption errors to HTTP status codes.
 */
const REDEMPTION_ERROR_STATUS: ReadonlyArray<
  [new (...args: never[]) => Error, number]
> = [
  [LinkNotFoundError, 404],
  [TeamNotFoundError, 404],
  [LinkInactiveError, 403],
  [LinkExpiredError, 403],
  [NotOrgMemberError, 403],
  [InvalidTeamChoiceError, 400],
  [InvalidRepoNameError, 400],
  [TeamFullError, 409],
  [TeamNotReadyError, 409],
  [TeamNameTakenError, 409],
  [RepoNameTakenError, 409],
  [MaxGroupsReachedError, 409],
];

function statusForRedemptionError(
  error: unknown
): number | null {
  for (const [ErrorClass, status] of REDEMPTION_ERROR_STATUS) {
    if (error instanceof ErrorClass) {
      return status;
    }
  }

  return null;
}

/**
 * GET /api/redeem/[linkId]
 *
 * Fetch redemption page data: link details, teams,
 * membership state, and any existing redemption.
 *
 * Accessible to both authenticated and unauthenticated users.
 * For unauthenticated users or non-members, teams are not
 * loaded to avoid unnecessary GitHub API calls.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ linkId: string }> }
) {
  try {
    const { linkId } = await params;
    const authContext = await getAuthContext(request);

    const link = await getRepoLinkByIdWithOrg(linkId);

    if (!link) {
      return NextResponse.json(
        { error: "Link not found" },
        { status: 404 }
      );
    }

    const pageData = await getRedemptionPageData(
      link,
      authContext
    );

    return NextResponse.json(pageData);
  } catch (error) {
    return internalError(
      "GET /api/redeem/[linkId]",
      error,
      "Failed to fetch redemption data"
    );
  }
}

/**
 * POST /api/redeem/[linkId]
 *
 * Redeem an assignment link for the authenticated user.
 *
 * Request body:
 * {
 *   teamId?: number,            // group: join existing team
 *   newTeamName?: string,       // group: create new team
 *   expectedTeamSize?: number,  // group: size of new team
 *   customSlug?: string         // solo: repo name suffix
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ linkId: string }> }
) {
  try {
    // 1. Authentication required
    const authContext = await getAuthContext(request);

    if (!authContext) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { linkId } = await params;

    // 2. Parse request body
    let body: {
      teamId?: unknown;
      newTeamName?: unknown;
      expectedTeamSize?: unknown;
      customSlug?: unknown;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    // 3. Validate and normalize body
    const teamId =
      typeof body.teamId === "number"
        ? body.teamId
        : undefined;

    const newTeamName =
      typeof body.newTeamName === "string"
        ? body.newTeamName.trim()
        : undefined;

    if (newTeamName !== undefined && newTeamName.length === 0) {
      return NextResponse.json(
        { error: "Team name cannot be empty" },
        { status: 400 }
      );
    }

    if (newTeamName && newTeamName.length > 255) {
      return NextResponse.json(
        { error: "Team name must be 255 characters or less" },
        { status: 400 }
      );
    }

    const expectedTeamSize =
      typeof body.expectedTeamSize === "number"
        ? body.expectedTeamSize
        : undefined;

    if (
      expectedTeamSize !== undefined &&
      (!Number.isInteger(expectedTeamSize) ||
        expectedTeamSize < 1)
    ) {
      return NextResponse.json(
        {
          error:
            "Expected team size must be a positive integer",
        },
        { status: 400 }
      );
    }

    const customSlug =
      typeof body.customSlug === "string"
        ? body.customSlug.trim()
        : undefined;

    if (customSlug && customSlug.length > 100) {
      return NextResponse.json(
        {
          error:
            "Custom slug must be 100 characters or less",
        },
        { status: 400 }
      );
    }

    // NEW: Validate custom slug produces at least one
    // alphanumeric character after slugification
    if (customSlug && !/[a-z0-9]/.test(slugify(customSlug))) {
      return NextResponse.json(
        {
          error:
            "Repository name suffix must contain at least " +
            "one letter or number",
        },
        { status: 400 }
      );
    }

    // 4. Fetch link with org info
    const link = await getRepoLinkByIdWithOrg(linkId);

    if (!link) {
      return NextResponse.json(
        { error: "Link not found" },
        { status: 404 }
      );
    }

    // 5. Attempt redemption
    try {
      const result = await redeemLink(
        link,
        authContext,
        { teamId, newTeamName, expectedTeamSize },
        customSlug || undefined
      );

      return NextResponse.json(result, { status: 201 });
    } catch (redeemError) {
      if (redeemError instanceof AlreadyRedeemedError) {
        const existing = await getStudentRedemption(
          link.id,
          authContext.githubId
        );

        if (existing) {
          return NextResponse.json(
            {
              repoName: existing.repo_name,
              repoUrl: existing.repo_url,
              cloneUrl: `git clone ${existing.repo_url}`,
              teamId: existing.team_id || undefined,
              alreadyRedeemed: true,
            },
            { status: 200 }
          );
        }

        return internalError(
          "POST /api/redeem/[linkId] (AlreadyRedeemed)",
          redeemError,
          "You have already redeemed this link, but we " +
          "could not retrieve your repository. " +
          "Please contact your instructor."
        );
      }

      const status = statusForRedemptionError(redeemError);

      if (status !== null && redeemError instanceof Error) {
        return NextResponse.json(
          { error: redeemError.message },
          { status }
        );
      }

      throw redeemError;
    }
  } catch (error) {
    return internalError(
      "POST /api/redeem/[linkId]",
      error,
      "Failed to redeem link"
    );
  }
}
