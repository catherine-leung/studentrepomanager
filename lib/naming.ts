// lib/naming.ts

/**
 * Pure naming and URL parsing helpers.
 * No server imports; safe for client components.
 */

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
 * Build the GitHub team name for a link + team combination.
 *
 * Format: {link_id}-{team_name}
 *
 * Ensures teams are unique org-wide even if two links have
 * teams with the same name. Example: "aBcD1234-myteam"
 */
export function buildGitHubTeamName(
  linkId: string,
  teamName: string
): string {
  return `${linkId}-${teamName}`;
}

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
