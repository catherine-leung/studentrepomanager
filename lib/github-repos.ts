// lib/github-repos.ts

import "server-only";

import type { Octokit } from "@octokit/rest";
import {
  slugify,
  slugifyTeamName,
  buildRepoName,
  parseTemplateRepoUrl,
  buildGitHubTeamName,
  toGitHubPermission,
  type AccessLevel,
  type GitHubPermission,
} from "./naming";

export type { AccessLevel, GitHubPermission };
export {
  slugify,
  slugifyTeamName,
  buildRepoName,
  parseTemplateRepoUrl,
  buildGitHubTeamName,
  toGitHubPermission,
};

/**
 * Check if an error is a specific HTTP status.
 *
 * Handles both @octokit/rest errors and generic Error objects.
 */
function isStatus(
  error: unknown,
  status: number
): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status: unknown }).status === status
  );
}

/**
 * Extract repo metadata from GitHub API response.
 */
export interface RepoInfo {
  name: string;
  htmlUrl: string;
  cloneUrl: string;
}

function extractRepoData(data: {
  name: string;
  html_url: string;
  clone_url: string;
}): RepoInfo {
  return {
    name: data.name,
    htmlUrl: data.html_url,
    cloneUrl: data.clone_url,
  };
}

/**
 * Check if a 422 error is specifically a "name already
 * exists" error. GitHub returns 422 for many reasons
 * (invalid name, template no longer marked as template,
 * repo limit reached, org policy). We only want to treat
 * "already exists" as a name collision.
 */
function isNameTakenError(error: unknown): boolean {
  const errors =
    (
      error as {
        response?: {
          data?: { errors?: Array<{ message?: string }> };
        };
      }
    ).response?.data?.errors ?? [];

  return errors.some((e) =>
    /already exists/i.test(e.message ?? "")
  );
}

// ============================================================================
// REPO OPERATIONS
// ============================================================================

/**
 * Fetch a repo, or null if it does not exist.
 *
 * @param octokit Authenticated Octokit instance
 * @param org Organization name
 * @param name Repository name
 * @returns Repository info, or null if 404
 * @throws Error on other failures
 */
export async function getRepo(
  octokit: Octokit,
  org: string,
  name: string
): Promise<RepoInfo | null> {
  try {
    const { data } = await (octokit as any).request(
      "GET /repos/{owner}/{repo}",
      { owner: org, repo: name }
    );
    return extractRepoData(data);
  } catch (error) {
    if (isStatus(error, 404)) {
      return null;
    }
    throw error;
  }
}

/**
 * Error thrown when a repo name is already taken.
 * This is a hard error: we never grant access to a
 * pre-existing repo.
 */
export class RepoExistsError extends Error {
  constructor(org: string, name: string) {
    super(
      `Repository ${org}/${name} already exists. ` +
      "The app can only create new repositories."
    );
    this.name = "RepoExistsError";
  }
}

/**
 * Create a repo. Never returns a pre-existing repo: a name
 * clash is a hard error so callers can never grant access to
 * a repository the app did not create for this redemption.
 *
 * @param octokit Authenticated Octokit instance (installation)
 * @param org Organization name
 * @param name Repository name
 * @param templateRepoUrl Optional template repo URL
 * @returns Repository info
 * @throws RepoExistsError on a 422 name conflict
 * @throws Error on other failures
 */
export async function createRepo(
  octokit: Octokit,
  org: string,
  name: string,
  templateRepoUrl: string | null
): Promise<RepoInfo> {
  try {
    if (templateRepoUrl) {
      const template = parseTemplateRepoUrl(
        templateRepoUrl
      );
      const { data } = await (octokit as any).request(
        "POST /repos/{template_owner}/{template_repo}/generate",
        {
          template_owner: template.owner,
          template_repo: template.repo,
          owner: org,
          name,
          private: true,
        }
      );
      return extractRepoData(data);
    }

    const { data } = await (octokit as any).request(
      "POST /orgs/{org}/repos",
      {
        org,
        name,
        private: true,
        auto_init: false,
      }
    );
    return extractRepoData(data);
  } catch (error) {
    if (isStatus(error, 422) && isNameTakenError(error)) {
      throw new RepoExistsError(org, name);
    }
    throw error;
  }
}

/**
 * Grant a user access to a repository.
 *
 * Adds the user as a collaborator with the specified
 * permission. If the user is not yet an org member, GitHub
 * creates an invitation (status 201). If they are a member,
 * they're added directly (status 204).
 *
 * Note: redeemLink() enforces org membership first, so 201
 * should never happen. If it does, we log a warning instead
 * of trying to auto-accept (which would require repo:invite
 * scope).
 *
 * @param appOctokit Authenticated as app (installation token)
 * @param org Organization name
 * @param repo Repository name
 * @param username GitHub username
 * @param level Access level (read, write, admin)
 * @throws Error if the operation fails
 */
export async function grantAccess(
  appOctokit: Octokit,
  org: string,
  repo: string,
  username: string,
  level: AccessLevel
): Promise<void> {
  const response = await (appOctokit as any).request(
    "PUT /repos/{owner}/{repo}/collaborators/{username}",
    {
      owner: org,
      repo,
      username,
      permission: toGitHubPermission(level),
    }
  );

  // 201: invitation created (user not yet org member)
  // 204: user added directly (already org member)
  //
  // redeemLink() enforces org membership first, so 201
  // should never happen. If it does, surface it instead of
  // failing silently or calling an API the user token
  // cannot use.
  if (response.status === 201) {
    console.warn(
      `Unexpected collaborator invitation for ${username} ` +
      `on ${org}/${repo}; they may not be an org member.`
    );
  }
}

/**
 * Create a GitHub Team in an organization.
 *
 * If a team with this name already exists (lost a race, or
 * the team was created outside the app), the existing team
 * is looked up by slug and returned instead.
 *
 * @param octokit Authenticated as app (installation token)
 * @param org Organization name
 * @param teamName Team name
 * @returns GitHub team ID and the slug GitHub assigned
 * @throws Error if team creation and lookup both fail
 */
export async function createGitHubTeam(
  octokit: Octokit,
  org: string,
  teamName: string
): Promise<{ id: number; slug: string }> {
  try {
    const { data } = await (octokit as any).request(
      "POST /orgs/{org}/teams",
      {
        org,
        name: teamName,
        privacy: "closed",
      }
    );

    return { id: data.id, slug: data.slug };
  } catch (error) {
    if (!isStatus(error, 422)) {
      throw error;
    }

    const { data } = await (octokit as any).request(
      "GET /orgs/{org}/teams/{team_slug}",
      {
        org,
        team_slug: slugifyTeamName(teamName),
      }
    );

    return { id: data.id, slug: data.slug };
  }
}

/**
 * Get the number of members in a GitHub Team.
 *
 * Fetches a single page of 100. Assignment teams are capped
 * at 10 by the link creation form, so this is always enough.
 *
 * @param octokit Authenticated as app (installation token)
 * @param org Organization name
 * @param teamSlug Team slug
 * @returns Member count
 * @throws Error if the team cannot be read (e.g. 404)
 */
export async function getTeamMemberCount(
  octokit: Octokit,
  org: string,
  teamSlug: string
): Promise<number> {
  const { data } = await (octokit as any).request(
    "GET /orgs/{org}/teams/{team_slug}/members",
    {
      org,
      team_slug: teamSlug,
      per_page: 100,
    }
  );

  return Array.isArray(data) ? data.length : 0;
}

/**
 * Add a user to a GitHub Team.
 *
 * @param octokit Authenticated as app (installation token)
 * @param org Organization name
 * @param teamSlug Team slug (lowercase, hyphens)
 * @param username GitHub username
 * @param role "member" or "maintainer"
 * @throws Error if operation fails
 */
export async function addTeamMember(
  octokit: Octokit,
  org: string,
  teamSlug: string,
  username: string,
  role: "member" | "maintainer" = "member"
): Promise<void> {
  await (octokit as any).request(
    "PUT /orgs/{org}/teams/{team_slug}/memberships/{username}",
    {
      org,
      team_slug: teamSlug,
      username,
      role,
    }
  );
}

/**
 * Grant a GitHub Team access to a repository.
 *
 * @param octokit Authenticated as app (installation token)
 * @param org Organization name
 * @param teamSlug Team slug
 * @param repo Repository name
 * @param permission "pull", "push", or "admin"
 * @throws Error if operation fails
 */
export async function grantTeamRepoAccess(
  octokit: Octokit,
  org: string,
  teamSlug: string,
  repo: string,
  permission: GitHubPermission
): Promise<void> {
  await (octokit as any).request(
    "PUT /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}",
    {
      org,
      team_slug: teamSlug,
      owner: org,
      repo,
      permission,
    }
  );
}

/**
 * Check whether a repository already exists in the org.
 */
export async function repoExists(
  octokit: Octokit,
  org: string,
  name: string
): Promise<boolean> {
  try {
    await (octokit as any).request(
      "GET /repos/{owner}/{repo}",
      { owner: org, repo: name }
    );
    return true;
  } catch (error) {
    if (isStatus(error, 404)) {
      return false;
    }
    throw error;
  }
}

/**
 * Delete a GitHub Team. Used for rollback when team creation
 * fails part-way.
 */
export async function deleteGitHubTeam(
  octokit: Octokit,
  org: string,
  teamSlug: string
): Promise<void> {
  await (octokit as any).request(
    "DELETE /orgs/{org}/teams/{team_slug}",
    { org, team_slug: teamSlug }
  );
}

/**
 * Delete a repository. Requires the App's
 * "Administration: write" permission. Used for rollback when
 * repo creation succeeds but later steps fail.
 */
export async function deleteRepo(
  octokit: Octokit,
  org: string,
  repo: string
): Promise<void> {
  await (octokit as any).request(
    "DELETE /repos/{owner}/{repo}",
    { owner: org, repo }
  );
}

/**
 * Archive a repository and rename it to free the original name.
 *
 * Used when cleaning up coursedocs resources: the repo is
 * renamed to {original}-removed-{linkId} and archived so the
 * name can be reused if the link is recreated.
 *
 * UPDATED: Truncate the base name to ensure the final name
 * doesn't exceed GitHub's 100-character limit.
 *
 * @param octokit Authenticated as app (installation token)
 * @param org Organization name
 * @param repo Current repository name
 * @param newName New repository name (will be truncated if needed)
 * @throws Error if operation fails
 */
export async function archiveRepo(
  octokit: Octokit,
  org: string,
  repo: string,
  newName: string
): Promise<void> {
  // Ensure the new name doesn't exceed 100 chars.
  // GitHub's limit is 255, but we're conservative.
  const truncatedName = newName.slice(0, 100);

  // Rename first; archived repos reject further edits.
  await (octokit as any).request(
    "PATCH /repos/{owner}/{repo}",
    {
      owner: org,
      repo,
      name: truncatedName,
    }
  );

  await (octokit as any).request(
    "PATCH /repos/{owner}/{repo}",
    {
      owner: org,
      repo: truncatedName,
      archived: true,
    }
  );
}

