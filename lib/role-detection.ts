// lib/role-detection.ts

import { getOctokitForUser } from "./github";
import type { AuthContext } from "./session";

export type UserRole = "owner" | "member" | "none";

export async function getUserRole(
  authContext: AuthContext | null,
  orgName: string
): Promise<UserRole> {
  if (!authContext?.accessToken) {
    return "none";
  }

  try {
    const octokit = getOctokitForUser(
      authContext.accessToken
    );

    const response = await octokit.orgs.getMembershipForUser({
      org: orgName,
      username: authContext.login,
    });

    return response.data.role === "admin"
      ? "owner"
      : "member";
  } catch {
    return "none";
  }
}

export async function requireRole(
  authContext: AuthContext | null,
  orgName: string,
  requiredRole: UserRole
): Promise<boolean> {
  const userRole = await getUserRole(
    authContext,
    orgName
  );

  if (requiredRole === "owner") {
    return userRole === "owner";
  }

  if (requiredRole === "member") {
    return (
      userRole === "owner" ||
      userRole === "member"
    );
  }

  return false;
}
