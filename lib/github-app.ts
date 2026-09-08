// lib/github-app.ts

import { App } from "@octokit/app";
import { Octokit } from "@octokit/rest";
import crypto from "crypto";

/**
 * Normalize the GitHub App private key.
 *
 * Handles three formats:
 * 1. PEM format (starts with "-----BEGIN")
 * 2. Base64-encoded PEM
 * 3. Literal \n sequences (from environment variables)
 */
function getPrivateKey(): string {
  const raw = process.env.GITHUB_APP_PRIVATE_KEY;

  if (!raw) {
    throw new Error(
      "GITHUB_APP_PRIVATE_KEY environment variable " +
      "is required"
    );
  }

  // If it starts with "-----BEGIN", it is already PEM
  if (raw.includes("-----BEGIN")) {
    return raw.replace(/\\n/g, "\n").trim();
  }

  // Otherwise, assume it is base64-encoded PEM
  try {
    const decoded = Buffer.from(raw, "base64")
      .toString("utf8");

    if (decoded.includes("-----BEGIN")) {
      return decoded.trim();
    }
  } catch {
    // Fall through to the error below
  }

  throw new Error(
    "GITHUB_APP_PRIVATE_KEY must be either PEM format " +
    "or base64-encoded PEM"
  );
}

/**
 * Create a GitHub App JWT token (valid for 10 minutes).
 * Used to authenticate as the app itself.
 */
function createGitHubAppJWT(): string {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = getPrivateKey();

  if (!appId) {
    throw new Error(
      "GITHUB_APP_ID environment variable is required"
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now - 60,
    exp: now + 600,
    iss: appId,
  };

  const header = base64url(
    JSON.stringify({
      alg: "RS256",
      typ: "JWT",
    })
  );

  const body = base64url(JSON.stringify(payload));

  const signature = crypto
    .createSign("RSA-SHA256")
    .update(`${header}.${body}`)
    .sign(privateKey, "base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  return `${header}.${body}.${signature}`;
}

/**
 * Helper: base64url encoding (no padding).
 */
function base64url(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Singleton App instance.
 * Handles JWT creation, token caching, and installation
 * lookups.
 */
let appInstance: App | null = null;

function getApp(): App {
  if (!appInstance) {
    const appId = process.env.GITHUB_APP_ID;

    if (!appId) {
      throw new Error(
        "GITHUB_APP_ID environment variable is required"
      );
    }

    appInstance = new App({
      appId,
      privateKey: getPrivateKey(),
    });
  }

  return appInstance;
}

/**
 * Get an Octokit instance authenticated as the GitHub App.
 * Used for app-level operations.
 */
export function getGitHubAppOctokit(): Octokit {
  const jwt = createGitHubAppJWT();
  return new Octokit({
    auth: `Bearer ${jwt}`,
  });
}

/**
 * Get the installation ID for a given organization.
 *
 * @param orgName Organization name (e.g. "cs101-fall25")
 * @returns Installation ID
 * @throws Error if the app is not installed on the org
 */
export async function getInstallationIdForOrg(
  orgName: string
): Promise<number> {
  if (!orgName.trim()) {
    throw new Error("Organization name is required");
  }

  try {
    const octokit = getGitHubAppOctokit();

    const { data } =
      await octokit.rest.apps.getOrgInstallation({
        org: orgName,
      });

    return data.id;
  } catch (error) {
    // Check both .status and .message for 404
    const is404 =
      (typeof error === "object" &&
        error !== null &&
        "status" in error &&
        (error as { status: unknown }).status === 404) ||
      (error instanceof Error &&
        error.message.includes("404"));

    if (is404) {
      throw new Error(
        `GitHub App not installed on organization '${orgName}'`
      );
    }

    throw error;
  }
}

/**
 * Get an Octokit instance authenticated as the app for a
 * specific installation.
 *
 * Installation tokens are cached by @octokit/app for their
 * full 1-hour lifetime, so repeated calls are cheap.
 *
 * @param installationId GitHub App installation ID
 * @returns Octokit instance with an installation token
 */
export async function getInstallationOctokit(
  installationId: number
): Promise<Octokit> {
  if (!installationId) {
    throw new Error("GitHub installation ID is required");
  }

  const app = getApp();
  const octokit = await app.getInstallationOctokit(
    installationId
  );

  return octokit as unknown as Octokit;
}

/**
 * Convenience: get an installation Octokit by org name.
 *
 * @param orgName Organization name
 * @returns Octokit instance with an installation token
 */
export async function getInstallationOctokitForOrg(
  orgName: string
): Promise<Octokit> {
  const installationId = await getInstallationIdForOrg(
    orgName
  );

  return getInstallationOctokit(installationId);
}

/**
 * The page where a user accepts a pending org invitation.
 */
export function getOrgInvitationUrl(org: string): string {
  return (
    "https://github.com/orgs/" +
    `${encodeURIComponent(org)}/invitation`
  );
}

/**
 * Send an organization invitation to a user.
 *
 * The user will receive a GitHub notification and can
 * accept the invitation via a link.
 *
 * @param installationId GitHub App installation ID
 * @param org Organization name
 * @param githubId GitHub user ID (not username)
 * @returns Invitation URL
 * @throws Error if invitation fails
 */
export async function sendOrgInvitation(
  installationId: number,
  org: string,
  githubId: number
): Promise<{ invitationUrl: string }> {
  if (!installationId || !org || !githubId) {
    throw new Error(
      "Installation ID, org name, and GitHub ID are required"
    );
  }

  try {
    const octokit = await getInstallationOctokit(
      installationId
    );

    await octokit.request("POST /orgs/{org}/invitations", {
      org,
      invitee_id: githubId,
      role: "direct_member",
    });

    // The invitation response contains no URL field. Org
    // invitations are always accepted at this fixed page.
    return { invitationUrl: getOrgInvitationUrl(org) };
  } catch (error) {
    const status =
      typeof error === "object" &&
      error !== null &&
      "status" in error
        ? (error as { status: unknown }).status
        : undefined;

    if (status === 422) {
      // GitHub puts the specific reason (already a member,
      // invitation already pending, etc.) in errors[].message.
      const detail = (
        error as {
          response?: {
            data?: { errors?: Array<{ message?: string }> };
          };
        }
      ).response?.data?.errors?.[0]?.message;

      throw new Error(
        detail ??
          "GitHub rejected the invitation " +
          "(user may already be a member)"
      );
    }

    throw error;
  }
}

// ---------------------------------------------------------------------------
// ORG BASE PERMISSIONS
// ---------------------------------------------------------------------------

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
  const { data } = await octokit.request("GET /orgs/{org}", {
    org,
    headers: { "Cache-Control": "no-cache" },
  });

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
 * Deep link to the "Member privileges" settings page, where
 * the base permission dropdown lives.
 */
export function getOrgSettingsUrl(org: string): string {
  return (
    "https://github.com/organizations/" +
    `${encodeURIComponent(org)}/settings/member_privileges`
  );
}

// ---------------------------------------------------------------------------
// APP INSTALLATIONS & ROLE CHECKING (Bug 1 fix)
// ---------------------------------------------------------------------------

function isStatus(error: unknown, status: number): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status: unknown }).status === status
  );
}

export interface AppInstallation {
  installationId: number;
  accountId: number;
  accountLogin: string;
  accountType: "Organization" | "User";
}

/**
 * Every account the App is installed on. Uses the App JWT, so
 * this is the authoritative list regardless of any user's
 * OAuth scopes or an org's third-party access policy.
 */
export async function listAppInstallations(): Promise<
  AppInstallation[]
> {
  const octokit = getGitHubAppOctokit();

  const installations = await octokit.paginate(
    octokit.rest.apps.listInstallations,
    { per_page: 100 }
  );

  const result: AppInstallation[] = [];

  for (const installation of installations) {
    const account = installation.account;

    if (
      installation.suspended_at ||
      !account ||
      !("login" in account)
    ) {
      continue;
    }

    result.push({
      installationId: installation.id,
      accountId: account.id,
      accountLogin: account.login,
      accountType:
        account.type === "Organization"
          ? "Organization"
          : "User",
    });
  }

  return result;
}

export type OrgRole = "owner" | "member" | "none";

/**
 * Resolve a user's role in an org using the installation token.
 * Pending invitations and non-members both resolve to "none".
 */
export async function getOrgRoleViaInstallation(
  installationId: number,
  org: string,
  username: string
): Promise<OrgRole> {
  const octokit = await getInstallationOctokit(installationId);

  try {
    const { data } = await octokit.request(
      "GET /orgs/{org}/memberships/{username}",
      {
        org,
        username,
        headers: { "Cache-Control": "no-cache" },
      }
    );

    if (data.state !== "active") {
      return "none";
    }

    return data.role === "admin" ? "owner" : "member";
  } catch (error) {
    if (isStatus(error, 404)) {
      return "none";
    }

    throw error;
  }
}
