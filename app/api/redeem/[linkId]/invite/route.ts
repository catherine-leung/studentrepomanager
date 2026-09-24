// app/api/redeem/[linkId]/invite/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/session";
import {
  getRepoLinkByIdWithOrg,
} from "@/lib/db";
import {
  sendOrgInvitation,
} from "@/lib/github-app";
import { isEmuLogin } from "@/lib/emu";
import { internalError } from "@/lib/api-errors";
import { COPY } from "@/lib/copy";

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
        { error: "Link not found" },
        { status: 404 }
      );
    }

    // 3. SECURITY: Check link is active and not expired
    const isExpired =
      link.expires_at !== null &&
      new Date(link.expires_at) < new Date();

    if (!link.is_active || isExpired) {
      return NextResponse.json(
        {
          error:
            "This link is no longer available",
        },
        { status: 403 }
      );
    }

    // 4. SECURITY / UX: Refuse up front if this account can
    // never join this org. GitHub itself would reject the
    // invitation for an Enterprise Managed User account trying
    // to reach a normal org (or vice versa) with a confusing
    // error; catch it here with a clear explanation instead.
    const studentIsEmu = isEmuLogin(authContext.login);

    if (link.org_is_emu !== studentIsEmu) {
      return NextResponse.json(
        {
          error: link.org_is_emu
            ? COPY.redeem.accountMismatch.needsEnterpriseAccount
                .message
            : COPY.redeem.accountMismatch.needsPersonalAccount
                .message,
        },
        { status: 409 }
      );
    }

    // 5. Send invitation
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
    return internalError(
      "POST /api/redeem/[linkId]/invite",
      error,
      "Failed to send invitation"
    );
  }
}
