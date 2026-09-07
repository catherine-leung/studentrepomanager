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
    const app = getApp();
    
    // Use the app's octokit instance for this installation
    const octokit = await app.getInstallationOctokit(
      installationId
    );

    // Call the API directly
    const response = await octokit.request(
      "POST /orgs/{org}/invitations",
      {
        org,
        invitee_id: githubId,
        role: "direct_member",
      }
    );

    return { invitationUrl: (response.data as any).invitation_url };
  } catch (error) {
    // Check for "already a member" error
    if (
      error instanceof Error &&
      error.message.includes("422")
    ) {
      throw new Error(
        "User is already a member of this organization"
      );
    }

    throw error;
  }
}
