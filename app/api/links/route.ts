// app/api/links/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/session";
import { requireRole } from "@/lib/role-detection";
import {
  getOrganizationByName,
  getRepoLinksByOrg,
} from "@/lib/db";
import { internalError } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  try {
    // 1. Authentication
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Query param
    const orgName = request.nextUrl.searchParams.get("org");
    if (!orgName) {
      return NextResponse.json(
        { error: "Missing 'org' query parameter" },
        { status: 400 }
      );
    }

    // 3. Authorization — must be org OWNER
    const isOwner = await requireRole(
      authContext,
      orgName,
      "owner"
    );
    if (!isOwner) {
      return NextResponse.json(
        {
          error:
            "Forbidden: you must be an owner of " +
            `'${orgName}' to view links`,
        },
        { status: 403 }
      );
    }

    // 4. Fetch links (empty array if org has none yet)
    const org = await getOrganizationByName(orgName);
    if (!org) {
      return NextResponse.json([]);
    }

    const links = await getRepoLinksByOrg(org.id);
    return NextResponse.json(links);
  } catch (error) {
    return internalError(
      "GET /api/links",
      error,
      "Failed to fetch links"
    );
  }
}
