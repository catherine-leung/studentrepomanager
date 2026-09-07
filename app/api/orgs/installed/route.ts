// app/api/orgs/installed/route.ts

import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/session";
import { createOrganization } from "@/lib/db";
import { getOctokitForUser } from "@/lib/github";
import {
  getInstallationIdForOrg,
} from "@/lib/github-app";

interface GitHubOrganization {
  login: string;
  id: number;
}

interface OwnedOrganization {
  login: string;
  id: number;
  installation_id: number;
}

export async function GET(req: NextRequest) {
  try {
    const authContext = await getAuthContext(req);

    if (!authContext) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userOctokit = getOctokitForUser(
      authContext.accessToken
    );

    // Get all organizations the user is an admin of
    const userOrganizationsResponse =
      await userOctokit.orgs.listForAuthenticatedUser({
        per_page: 100,
      });

    const userOrganizations =
      userOrganizationsResponse.data as GitHubOrganization[];

    // For each org, check if the app is installed
    // and if the user is an owner
    const ownedOrganizations = await Promise.all(
      userOrganizations.map(
        async (
          organization
        ): Promise<OwnedOrganization | null> => {
          try {
            // Check if user is an admin of this org
            const membership =
              await userOctokit.orgs.getMembershipForUser({
                org: organization.login,
                username: authContext.login,
              });

            if (membership.data.role !== "admin") {
              return null;
            }

            // Check if app is installed on this org
            const installationId =
              await getInstallationIdForOrg(
                organization.login
              );

            return {
              login: organization.login,
              id: organization.id,
              installation_id: installationId,
            };
          } catch (error) {
            // App not installed on this org, or user
            // is not an admin — skip it
            return null;
          }
        }
      )
    );

    const organizations = ownedOrganizations.filter(
      (
        organization
      ): organization is OwnedOrganization => {
        return organization !== null;
      }
    );

    // Upsert all orgs into the database
    await Promise.all(
      organizations.map((organization) => {
        return createOrganization(
          organization.login,
          organization.installation_id
        );
      })
    );

    return NextResponse.json(organizations);
  } catch (error) {
    console.error(
      "Error fetching installed organizations:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch organizations",
      },
      { status: 500 }
    );
  }
}
