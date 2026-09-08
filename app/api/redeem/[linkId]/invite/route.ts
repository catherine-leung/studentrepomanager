// app/api/redeem/[linkId]/invite/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/session";
import {
  getRepoLinkByIdWithOrg,
} from "@/lib/db";
import {
  sendOrgInvitation,
} from "@/lib/github-app";

/**
 * POST /api/redeem/[linkId]/invite
 *
 * Send an organization invitation to the authenticated user.
 *
 * This is called when a student is not yet an org member
 * and needs to join before redeeming.
 *
 * Returns:
 * {
 *   invitationUrl: string  // GitHub invitation link
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

    // 2. Fetch link with org info
    const link = await getRepoLinkByIdWithOrg(linkId);

    if (!link) {
      return NextResponse.json(
        { error: "Assignment link not found" },
        { status: 404 }
      );
    }

    // 3. Send invitation
    try {
      const { invitationUrl } =
        await sendOrgInvitation(
          link.installation_id,
          link.org_name,
          authContext.githubId
        );

      return NextResponse.json(
        { invitationUrl },
        { status: 200 }
      );
    } catch (error) {
      // GitHub: "Invitee is already a part of this org"
      if (
        error instanceof Error &&
        /already (a member|a part of)/i.test(error.message)
      ) {
        return NextResponse.json(
          {
            error:
              "You are already a member of this organization",
          },
          { status: 409 }
        );
      }

      throw error;
    }
  } catch (error) {
    console.error(
      "Error in POST /api/redeem/[linkId]/invite:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to send invitation",
      },
      { status: 500 }
    );
  }
}
