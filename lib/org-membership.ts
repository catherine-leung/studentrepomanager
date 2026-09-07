// lib/org-membership.ts

import { getInstallationOctokitForOrg } from "./github-app";

/**
 * Membership state in an organization.
 *
 * - "active": User is a confirmed member of the org.
 * - "pending": User has been invited but hasn't accepted yet.
 * - "none": User is not a member and has no pending invitation.
 */
export type MembershipState = "active" | "pending" | "none";

/**
 * Get a user's membership state in an organization.
 *
 * Uses the GitHub App's installation token for the org,
 * which has permission to check all members.
 *
 * @param orgName Organization name
 * @param username Username to check
 * @returns Membership state
 */
export async function getOrgMembershipState(
  orgName: string,
  username: string
): Promise<MembershipState> {
  if (!orgName || !username) {
    return "none";
  }

  try {
    const octokit = await getInstallationOctokitForOrg(
      orgName
    );

    const { data } = await (octokit as any).request(
      "GET /orgs/{org}/memberships/{username}",
      {
        org: orgName,
        username,
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
        },
      }
    );

    // GitHub returns state: "active" or "pending"
    return (data as any).state === "active"
      ? "active"
      : "pending";
  } catch (error) {
    // 404 or other error → not a member
    return "none";
  }
}

/**
 * Check if a user is an active member of an organization.
 *
 * Returns true only if state is "active".
 * Pending invitations return false.
 *
 * @param orgName Organization name
 * @param username Username to check
 * @returns true if active member, false otherwise
 */
export async function isOrgMember(
  orgName: string,
  username: string
): Promise<boolean> {
  const state = await getOrgMembershipState(
    orgName,
    username
  );
  return state === "active";
}
