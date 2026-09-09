// app/api/links/[linkId]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/session";
import { requireRole } from "@/lib/role-detection";
import {
  getRepoLinkByIdWithOrg,
  updateRepoLinkStatus,
  deleteRepoLink,
  getTeamsByLink,
  RepoLinkHasRedemptionsError,
  RepoLinkNotFoundError,
} from "@/lib/db";
import { internalError } from "@/lib/api-errors";

export const maxDuration = 60;

/**
 * Verify that the authenticated user owns the link's organization.
 * Returns the link if authorized, or a NextResponse error if not.
 */
async function requireLinkOwner(
  authContext: Awaited<ReturnType<typeof getAuthContext>>,
  linkId: string
): Promise<
  | { link: Awaited<ReturnType<typeof getRepoLinkByIdWithOrg>>; error: null }
  | { link: null; error: NextResponse }
> {
  if (!authContext) {
    return {
      link: null,
      error: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  const link = await getRepoLinkByIdWithOrg(linkId);

  if (!link) {
    return {
      link: null,
      error: NextResponse.json(
        { error: "Assignment link not found" },
        { status: 404 }
      ),
    };
  }

  const isOwner = await requireRole(
    authContext,
    link.org_name,
    "owner"
  );

  if (!isOwner) {
    return {
      link: null,
      error: NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      ),
    };
  }

  return { link, error: null };
}

export async function PATCH(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ linkId: string }>;
  }
) {
  try {
    const authContext = await getAuthContext(request);
    const { linkId } = await params;

    const { link, error } = await requireLinkOwner(
      authContext,
      linkId
    );

    if (error) {
      return error;
    }

    if (!link) {
      return NextResponse.json(
        { error: "Assignment link not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const isActive = body.isActive;

    if (typeof isActive !== "boolean") {
      return NextResponse.json(
        { error: "isActive must be a boolean" },
        { status: 400 }
      );
    }

    const updated = await updateRepoLinkStatus(
      linkId,
      isActive
    );

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof RepoLinkNotFoundError) {
      return NextResponse.json(
        { error: "Assignment link not found" },
        { status: 404 }
      );
    }

    return internalError(
      "PATCH /api/links/[linkId]",
      error,
      "Failed to update link"
    );
  }
}

export async function DELETE(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ linkId: string }>;
  }
) {
  try {
    const authContext = await getAuthContext(request);
    const { linkId } = await params;

    const { link, error } = await requireLinkOwner(
      authContext,
      linkId
    );

    if (error) {
      return error;
    }

    if (!link) {
      return NextResponse.json(
        { error: "Assignment link not found" },
        { status: 404 }
      );
    }

    // For coursedocs links, capture the team before
    // deletion (the team row will be cascade-deleted)
    let coursedocsTeam = null;

    if (link.link_type === "coursedocs") {
      const teams = await getTeamsByLink(link.id);
      coursedocsTeam = teams[0] ?? null;
    }

    // Delete the link (and cascade-delete the team row)
    await deleteRepoLink(linkId);

    // Clean up GitHub resources after DB deletion
    if (coursedocsTeam) {
      const { cleanupCoursedocsResources } = await import(
        "@/lib/coursedocs"
      );

      await cleanupCoursedocsResources(
        link.installation_id,
        link.org_name,
        link.link_id,
        coursedocsTeam
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof RepoLinkHasRedemptionsError) {
      return NextResponse.json(
        {
          error:
            "This link has redemptions and can only be " +
            "deactivated.",
        },
        { status: 409 }
      );
    }

    if (error instanceof RepoLinkNotFoundError) {
      return NextResponse.json(
        { error: "Assignment link not found" },
        { status: 404 }
      );
    }

    return internalError(
      "DELETE /api/links/[linkId]",
      error,
      "Failed to delete link"
    );
  }
}
