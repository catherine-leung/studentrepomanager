// app/api/orgs/[orgName]/permissions/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/session";
import { requireRole } from "@/lib/role-detection";
import { getOctokitForUser } from "@/lib/github";
import {
  getInstallationIdForOrg,
  getOrgBasePermission,
  readOrgBasePermission,
  getOrgSettingsUrl,
  type BasePermission,
} from "@/lib/github-app";

export interface OrgPermissionsResponse {
  orgName: string;
  basePermission: BasePermission;
  isCorrect: boolean;
  settingsUrl: string;
  instructions: string[];
}

const FIX_INSTRUCTIONS = [
  "Open your organization's Settings → Member privileges page.",
  'Under "Base permissions", choose "No permission".',
  "Click Save.",
  'Return here and click "Re-check".',
];

/**
 * GET /api/orgs/[orgName]/permissions
 *
 * Report the org's base repository permission. Students should
 * only see repositories they are explicitly granted, which
 * requires the base permission to be "none".
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgName: string }> }
) {
  try {
    const authContext = await getAuthContext(request);

    if (!authContext) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { orgName } = await params;

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
            `'${orgName}' to view its permissions`,
        },
        { status: 403 }
      );
    }

    const installationId =
      await getInstallationIdForOrg(orgName);

    let basePermission = await getOrgBasePermission(
      installationId,
      orgName
    );

    // GitHub withholds the field from callers it does not
    // consider "full detail" readers. The signed-in owner is
    // always allowed to see it, so try their token next.
    if (basePermission === "unknown") {
      const userOctokit = getOctokitForUser(
        authContext.accessToken
      );
      basePermission = await readOrgBasePermission(
        userOctokit,
        orgName
      );
    }

    const body: OrgPermissionsResponse = {
      orgName,
      basePermission,
      isCorrect: basePermission === "none",
      settingsUrl: getOrgSettingsUrl(orgName),
      instructions: FIX_INSTRUCTIONS,
    };

    return NextResponse.json(body);
  } catch (error) {
    console.error(
      "Error in GET /api/orgs/[orgName]/permissions:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to check organization permissions",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/orgs/[orgName]/permissions
 *
 * Update the org's base repository permission.
 * Currently only supports setting to "none".
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgName: string }> }
) {
  try {
    const authContext = await getAuthContext(request);

    if (!authContext) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { orgName } = await params;

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
            `'${orgName}' to update its permissions`,
        },
        { status: 403 }
      );
    }

    let body: { basePermission?: unknown };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { basePermission } = body;

    if (basePermission !== "none") {
      return NextResponse.json(
        {
          error:
            "Only 'none' is supported for base permission updates",
        },
        { status: 400 }
      );
    }

    // Use the owner's OAuth token to update the org setting.
    // The GitHub App's installation token does not have
    // admin:org write permission.
    const userOctokit = getOctokitForUser(
      authContext.accessToken
    );

    await userOctokit.request("PATCH /orgs/{org}", {
      org: orgName,
      default_repository_permission: "none",
    });

    // Return the updated state
    const installationId =
      await getInstallationIdForOrg(orgName);

    let updatedPermission = await getOrgBasePermission(
      installationId,
      orgName
    );

    if (updatedPermission === "unknown") {
      updatedPermission = await readOrgBasePermission(
        userOctokit,
        orgName
      );
    }

    const response: OrgPermissionsResponse = {
      orgName,
      basePermission: updatedPermission,
      isCorrect: updatedPermission === "none",
      settingsUrl: getOrgSettingsUrl(orgName),
      instructions: FIX_INSTRUCTIONS,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error(
      "Error in PATCH /api/orgs/[orgName]/permissions:",
      error
    );

    // Check if it's a GitHub API error about permissions
    if (
      error instanceof Error &&
      error.message.includes("403")
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to update " +
            "organization settings. Make sure you are an " +
            "owner and have authorized the app with " +
            "admin:org scope.",
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update organization permissions",
      },
      { status: 500 }
    );
  }
}
