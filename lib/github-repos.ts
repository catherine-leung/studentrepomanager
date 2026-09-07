// lib/github-repos.ts

import type { Octokit } from "@octokit/rest";

export type AccessLevel = "read" | "write" | "admin";
export type GitHubPermission = "pull" | "push" | "admin";

/**
 * Convert our access level to GitHub's permission model.
 */
export function toGitHubPermission(
  level: AccessLevel
): GitHubPermission {
  switch (level) {
    case "read":
      return "pull";
    case "write":
      return "push";
    case "admin":
      return "admin";
  }
}

/**
 * Slugify a string: lowercase, replace non-alphanumeric
 * with hyphens, trim hyphens, collapse multiple hyphens.
 *
 * Examples:
 *   "Lab 1: Sorting" → "lab-1-sorting"
 *   "My Solution!!!" → "my-solution"
 *   "---test---" → "test"
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

/**
 * Slugify a team name the way GitHub does (approximately):
 * lowercase, only [a-z0-9-], collapsed and trimmed hyphens.
 *
 * Used for collision detection and as a fallback when a
 * team's real GitHub slug has not been recorded yet.
 */
export function slugifyTeamName(teamName: string): string {
  return teamName
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Build a repository name from assessment name and suffix.
 *
 * Format: {slugify(assessment)}-{slugify(suffix)}
 * Max length: 100 chars (GitHub limit is 255, but we're
 * conservative). Trailing hyphens are trimmed.
 *
 * Examples:
 *   ("Lab 1: Sorting", "alice") → "lab-1-sorting-alice"
 *   ("X", "") → "x" (suffix is empty, just use assessment)
 */
export function buildRepoName(
  assessmentName: string,
  suffix: string
): string {
  const base = slugify(assessmentName) || "assignment";
  const tail = slugify(suffix);

  if (!tail) {
    return base.slice(0, 100);
  }

  const combined = `${base}-${tail}`;
  return combined
    .slice(0, 100)
    .replace(/-+$/, "");
}

/**
 * Parse a GitHub repository URL into owner and repo name.
 *
 * Accepts:
 *   https://github.com/owner/repo
 *   https://github.com/owner/repo/
 *   https://github.com/owner/repo.git
 *
 * Throws if the URL is invalid.
 */
export function parseTemplateRepoUrl(
  url: string
): { owner: string; repo: string } {
  const match = url.match(
    /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/
  );

  if (!match) {
    throw new Error(
      "Invalid template repository URL. " +
      "Expected: https://github.com/owner/repo"
    );
  }

  return {
    owner: match[1],
    repo: match[2],
  };
}

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
function extractRepoData(data: {
  name: string;
  html_url: string;
  clone_url: string;
}): { name: string; htmlUrl: string; cloneUrl: string } {
  return {
    name: data.name,
    htmlUrl: data.html_url,
    cloneUrl: data.clone_url,
  };
}

/**
 * Ensure a repository exists, creating it if necessary.
 *
 * If the repo already exists, return its details.
 * If it doesn't exist, create it (from template if provided).
 * If creation fails with 422 (name conflict), fetch and return
 * the existing repo (handles race condition).
 *
 * @param octokit Authenticated Octokit instance (installation)
 * @param org Organization name
 * @param name Repository name
 * @param templateRepoUrl Optional template repo URL
 * @returns Repository name, HTML URL, and clone URL
 * @throws Error if repo fetch/creation fails
 */
export async function ensureRepo(
  octokit: Octokit,
  org: string,
  name: string,
  templateRepoUrl: string | null
): Promise<{
  name: string;
  htmlUrl: string;
  cloneUrl: string;
}> {
  // 1. Try to fetch existing repo
  try {
    const { data } = await (octokit as any).request(
      "GET /repos/{owner}/{repo}",
      {
        owner: org,
        repo: name,
      }
    );
    return extractRepoData(data);
  } catch (error) {
    if (!isStatus(error, 404)) {
      throw error;
    }
    // Repo doesn't exist; proceed to creation
  }

  // 2. Create repo (from template or blank)
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
    // Lost a race: another request created the same
    // repo name. Fetch and return it.
    if (isStatus(error, 422)) {
      const { data } = await (octokit as any).request(
        "GET /repos/{owner}/{repo}",
        {
          owner: org,
          repo: name,
        }
      );
      return extractRepoData(data);
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
 * If an invitation was created (201), automatically accept
 * it using the user's OAuth token.
 *
 * @param appOctokit Authenticated as app (installation token)
 * @param userOctokit Authenticated as user (user OAuth token)
 * @param org Organization name
 * @param repo Repository name
 * @param username GitHub username
 * @param level Access level (read, write, admin)
 * @throws Error if the operation fails
 */
export async function grantAccess(
  appOctokit: Octokit,
  userOctokit: Octokit,
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
  if (response.status === 201 && response.data?.id) {
    await (userOctokit as any).request(
      "PATCH /user/repository_invitations/{invitation_id}",
      {
        invitation_id: response.data.id,
      }
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
