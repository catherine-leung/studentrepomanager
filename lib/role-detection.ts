// lib/role-detection.ts

import type { AuthContext } from "./session";
import { getOrganizationByName } from "./db";
import {
  getInstallationIdForOrg,
  getOrgRoleViaInstallation,
} from "./github-app";

export type UserRole = "owner" | "member" | "none";

/**
 * Resolve a user's role in an org using the installation token.
 * This is immune to OAuth App restrictions and third-party
 * access policies.
 */
export async function getUserRole(
  authContext: AuthContext | null,
  orgName: string
): Promise<UserRole> {
  if (!authContext) {
    return "none";
  }

  try {
    // Prefer the cached installation id; fall back to GitHub.
    const org = await getOrganizationByName(orgName);
    const installationId =
      org?.installation_id ??
      (await getInstallationIdForOrg(orgName));

    return await getOrgRoleViaInstallation(
      installationId,
      orgName,
      authContext.login
    );
  } catch (error) {
    console.error(
      `Role check failed for ${authContext.login} ` +
      `in ${orgName}:`,
      error
    );
    return "none";
  }
}

export async function requireRole(
  authContext: AuthContext | null,
  orgName: string,
  requiredRole: UserRole
): Promise<boolean> {
  const userRole = await getUserRole(authContext, orgName);

  if (requiredRole === "owner") {
    return userRole === "owner";
  }

  if (requiredRole === "member") {
    return userRole === "owner" || userRole === "member";
  }

  return false;
}
