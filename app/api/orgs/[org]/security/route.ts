// app/api/orgs/[org]/security/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/session";
import { requireRole } from "@/lib/role-detection";
import { getOrganizationByName } from "@/lib/db";
import {
  checkOrgSecurity,
  applyOrgSecuritySettings,
} from "@/lib/org-settings";
import { internalError } from "@/lib/api-errors";

async function authorize(
  req: NextRequest,
  org: string
): Promise<
  | { installationId: number; error: null }
  | { installationId: null; error: NextResponse }
> {
  const auth = await getAuthContext(req);

  if (!auth) {
    return {
      installationId: null,
      error: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  if (!(await requireRole(auth, org, "owner"))) {
    return {
      installationId: null,
      error: NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      ),
    };
  }

  const row = await getOrganizationByName(org);

  if (!row) {
    return {
      installationId: null,
      error: NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      ),
    };
  }

  return { installationId: row.installation_id, error: null };
}

/**
 * GET /api/orgs/[org]/security
 *
 * Check the current security posture of an organization.
 * Returns the base permission and whether it is set to "none".
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ org: string }> }
) {
  try {
    const { org } = await params;
    const { installationId, error } = await authorize(req, org);

    if (error) {
      return error;
    }

    return NextResponse.json(
      await checkOrgSecurity(installationId, org)
    );
  } catch (error) {
    return internalError(
      "GET /api/orgs/[org]/security",
      error,
      "Failed to check organization settings"
    );
  }
}

/**
 * POST /api/orgs/[org]/security
 *
 * Apply security settings to an organization.
 * Returns the updated security status.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ org: string }> }
) {
  try {
    const { org } = await params;
    const { installationId, error } = await authorize(req, org);

    if (error) {
      return error;
    }

    await applyOrgSecuritySettings(installationId, org);

    return NextResponse.json(
      await checkOrgSecurity(installationId, org)
    );
  } catch (error) {
    return internalError(
      "POST /api/orgs/[org]/security",
      error,
      "Failed to apply organization settings"
    );
  }
}
