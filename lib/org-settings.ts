// lib/org-settings.ts

import "server-only";

import { getInstallationOctokit } from "./github-app";
import { getOrgSettingsUrl } from "./github-urls";
import type { Octokit } from "@octokit/rest";

export type BasePermission =
  | "none"
  | "read"
  | "write"
  | "admin"
  | "unknown";

function toBasePermission(value: unknown): BasePermission {
  if (
    value === "none" ||
    value === "read" ||
    value === "write" ||
    value === "admin"
  ) {
    return value;
  }

  return "unknown";
}

/**
 * Read `default_repository_permission` for an org using an
 * arbitrary Octokit. GitHub only includes this field when the
 * caller is authorized to see full org details; otherwise it is
 * absent and we report "unknown".
 */
export async function readOrgBasePermission(
  octokit: Octokit,
  org: string
): Promise<BasePermission> {
  const { data } = await octokit.request(
    "GET /orgs/{org}",
    {
      org,
      headers: { "Cache-Control": "no-cache" },
    }
  );

  const value = (
    data as { default_repository_permission?: string | null }
  ).default_repository_permission;

  return toBasePermission(value);
}

/**
 * Fetch the org's base repository permission using the App's
 * installation token.
 *
 * Returns "unknown" if GitHub withholds the field. The caller
 * may fall back to the owner's OAuth token in that case.
 */
export async function getOrgBasePermission(
  installationId: number,
  org: string
): Promise<BasePermission> {
  const octokit = await getInstallationOctokit(installationId);
  return readOrgBasePermission(octokit, org);
}

/**
 * Apply the security settings that the REST API actually
 * supports.
 *
 * Note: "Members can change visibility / delete / transfer
 * repos" and "members can create teams" are NOT exposed by
 * PATCH /orgs/{org}; they remain manual settings that must be
 * configured in the GitHub UI.
 *
 * @param installationId GitHub App installation ID
 * @param org Organization name
 * @throws Error if the operation fails
 */
export async function applyOrgSecuritySettings(
  installationId: number,
  org: string
): Promise<void> {
  const octokit = await getInstallationOctokit(installationId);

  await octokit.request("PATCH /orgs/{org}", {
    org,
    default_repository_permission: "none",
    members_can_create_repositories: false,
    members_can_create_public_repositories: false,
    members_can_create_private_repositories: false,
    members_can_fork_private_repositories: false,
  });
}

export interface OrgSecurityStatus {
  basePermission: BasePermission;
  ok: boolean;
  settingsUrl: string;
}

/**
 * Check the current security posture of an organization.
 *
 * Returns the base permission and whether it is set to "none"
 * (the required value for classroom use).
 */
export async function checkOrgSecurity(
  installationId: number,
  org: string
): Promise<OrgSecurityStatus> {
  const basePermission = await getOrgBasePermission(
    installationId,
    org
  );

  return {
    basePermission,
    ok: basePermission === "none",
    settingsUrl: getOrgSettingsUrl(org),
  };
}
