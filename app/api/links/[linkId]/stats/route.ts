// app/api/links/[linkId]/stats/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/session";
import { requireRole } from "@/lib/role-detection";
import {
  getRepoLinkByIdWithOrg,
  getLinkStats,
  getLinkRedemptions,
} from "@/lib/db";
import { internalError } from "@/lib/api-errors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ linkId: string }> }
) {
  try {
    // 1. Authentication
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { linkId } = await params;

    // 2. Look up link + owning org in one query
    const link = await getRepoLinkByIdWithOrg(linkId);
    if (!link) {
      return NextResponse.json(
        { error: "Link not found" },
        { status: 404 }
      );
    }

    // 3. Authorization – must own the link's org
    const isOwner = await requireRole(
      authContext,
      link.org_name,
      "owner"
    );
    if (!isOwner) {
      return NextResponse.json(
        {
          error:
            "Forbidden: you must be an owner of " +
            `'${link.org_name}' to view stats`,
        },
        { status: 403 }
      );
    }

    // 4. Fetch stats and redemptions
    const [stats, redemptions] = await Promise.all([
      getLinkStats(linkId),
      getLinkRedemptions(linkId),
    ]);

    return NextResponse.json({ stats, redemptions });
  } catch (error) {
    return internalError(
      "GET /api/links/[linkId]/stats",
      error,
      "Failed to fetch link stats"
    );
  }
}
