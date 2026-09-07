// lib/redeem.ts

import type { AuthContext } from "./session";
import type { RepoCreationLink, Team } from "./types";
import {
  getRepoLinkById,
  getTeamsByLink,
  getTeamById,
  getTeamMemberCount,
  createTeam,
  updateTeamGithubId,
  setTeamRepo,
  createStudentRepoAccess,
  hasStudentRedeemed,
  canStudentJoinTeam,
  getStudentRedemption,
} from "./db";
import {
  buildRepoName,
  ensureRepo,
  grantAccess,
  createGitHubTeam,
  addTeamMember,
  grantTeamRepoAccess,
  toGitHubPermission,
} from "./github-repos";
import {
  getInstallationOctokit,
} from "./github-app";
import { getOctokitForUser } from "./github";
import { isOrgMember, getOrgMembershipState } from "./org-membership";

// ============================================================================
// TYPED ERRORS
// ============================================================================

export class LinkNotFoundError extends Error {
  constructor(linkId: string) {
    super(`Assignment link '${linkId}' not found`);
    this.name = "LinkNotFoundError";
  }
}

export class LinkInactiveError extends Error {
  constructor() {
    super("This assignment link is inactive");
    this.name = "LinkInactiveError";
  }
}

export class LinkExpiredError extends Error {
  constructor() {
    super("This assignment link has expired");
    this.name = "LinkExpiredError";
  }
}

export class NotOrgMemberError extends Error {
  constructor(orgName: string) {
    super(
      `You must be a member of '${orgName}' ` +
      "to redeem this link"
    );
    this.name = "NotOrgMemberError";
  }
}

export class AlreadyRedeemedError extends Error {
  constructor() {
    super("You have already redeemed this link");
    this.name = "AlreadyRedeemedError";
  }
}

export class TeamNotFoundError extends Error {
  constructor(teamId: number) {
    super(`Team ${teamId} not found`);
    this.name = "TeamNotFoundError";
  }
}

export class TeamFullError extends Error {
  constructor() {
    super("This team is full");
    this.name = "TeamFullError";
  }
}

export class InvalidTeamChoiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTeamChoiceError";
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get the member count for a GitHub team.
 *
 * @param octokit Authenticated Octokit instance
 * @param org Organization name
 * @param teamSlug Team slug
 * @returns Number of members in the team
 */
async function getGitHubTeamMemberCount(
  octokit: any,
  org: string,
  teamSlug: string
): Promise<number> {
  try {
    const response = await octokit.request(
      "GET /orgs/{org}/teams/{team_slug}/members",
      {
        org,
        team_slug: teamSlug,
        per_page: 1,
      }
    );

    // The response headers contain the total count
    const linkHeader = response.headers.link || "";
    const match = linkHeader.match(/&page=(\d+)>; rel="last"/);
    
    if (match) {
      return parseInt(match[1], 10);
    }

    // If no pagination, return the count of items in this page
    return response.data.length;
  } catch (error) {
    console.error(
      `Error getting GitHub team member count for ${org}/${teamSlug}:`,
      error
    );
    return 0;
  }
}

/**
 * Convert team name to GitHub team slug.
 *
 * @param teamName Team name
 * @returns GitHub team slug
 */
function teamNameToSlug(teamName: string): string {
  return teamName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate that a link is active and not expired.
 *
 * @throws LinkInactiveError if link is not active
 * @throws LinkExpiredError if link has expired
 */
function validateLinkActive(
  link: RepoCreationLink
): void {
  if (!link.is_active) {
    throw new LinkInactiveError();
  }

  if (
    link.expires_at &&
    new Date(link.expires_at) < new Date()
  ) {
    throw new LinkExpiredError();
  }
}

/**
 * Validate that a user is an org member.
 *
 * @throws NotOrgMemberError if not a member
 */
async function validateOrgMembership(
  orgName: string,
  username: string
): Promise<void> {
  const isMember = await isOrgMember(
    orgName,
    username
  );

  if (!isMember) {
    throw new NotOrgMemberError(orgName);
  }
}

// ============================================================================
// TEAM RESOLUTION
// ============================================================================

interface TeamChoice {
  teamId?: number;
  newTeamName?: string;
  expectedTeamSize?: number;
}

/**
 * Resolve a team choice to a team ID.
 *
 * For group assignments:
 * - If teamId is provided, validate it exists and has capacity
 * - If newTeamName is provided, create a new team
 * - Otherwise, throw an error
 *
 * For solo assignments, this is a no-op (returns undefined).
 *
 * @param link The assignment link
 * @param choice Team choice (teamId or newTeamName)
 * @param octokit Authenticated Octokit instance for GitHub API calls
 * @param orgName Organization name
 * @returns Team ID, or undefined for solo assignments
 * @throws InvalidTeamChoiceError if choice is invalid
 * @throws TeamNotFoundError if teamId doesn't exist
 * @throws TeamFullError if team is at capacity
 */
async function resolveTeam(
  link: RepoCreationLink,
  choice: TeamChoice,
  octokit: any,
  orgName: string
): Promise<Team | undefined> {
  if (link.link_type === "solo") {
    return undefined;
  }

  // Group assignment: must have a team choice
  if (!choice.teamId && !choice.newTeamName) {
    throw new InvalidTeamChoiceError(
      "Team ID or new team name is required " +
      "for group assignments"
    );
  }

  // Join existing team
  if (choice.teamId) {
    const team = await getTeamById(choice.teamId);

    if (!team) {
      throw new TeamNotFoundError(choice.teamId);
    }

    if (team.link_id !== link.id) {
      throw new InvalidTeamChoiceError(
        "Team does not belong to this assignment"
      );
    }

    // Check GitHub for real member count
    if (team.github_team_id) {
      const teamSlug = teamNameToSlug(team.team_name);
      const memberCount = await getGitHubTeamMemberCount(
        octokit,
        orgName,
        teamSlug
      );

      const expectedSize = team.expected_team_size || 0;
      if (memberCount >= expectedSize) {
        throw new TeamFullError();
      }
    }

    return team;
  }

  // Create new team
  if (choice.newTeamName) {
    if (!choice.expectedTeamSize) {
      throw new InvalidTeamChoiceError(
        "Expected team size is required when creating a new team"
      );
    }

    if (
      !Number.isInteger(choice.expectedTeamSize) ||
      choice.expectedTeamSize < 1
    ) {
      throw new InvalidTeamChoiceError(
        "Expected team size must be a positive integer"
      );
    }

    if (
      link.max_team_size &&
      choice.expectedTeamSize > link.max_team_size
    ) {
      throw new InvalidTeamChoiceError(
        `Expected team size cannot exceed the maximum of ${link.max_team_size}`
      );
    }

    const newTeam = await createTeam(
      link.id,
      choice.newTeamName,
      choice.expectedTeamSize
    );

    return newTeam;
  }

  throw new InvalidTeamChoiceError(
    "Invalid team choice"
  );
}

// ============================================================================
// REDEMPTION ORCHESTRATION
// ============================================================================

export interface RedemptionResult {
  repoName: string;
  repoUrl: string;
  cloneUrl: string;
  teamId?: number;
  alreadyRedeemed: boolean;
}

/**
 * Redeem an assignment link for a student.
 *
 * This is the main orchestration function. It:
 * 1. Validates the link (active, not expired)
 * 2. Checks org membership
 * 3. Checks for duplicate redemption (idempotency)
 * 4. Resolves team (for group assignments)
 * 5. Creates/fetches repository
 * 6. Grants access (user or team)
 * 7. Records redemption in database
 *
 * @param link The assignment link (with org_name and installation_id)
 * @param authContext User's auth context
 * @param choice Team choice (for group assignments)
 * @param customSlug Optional custom slug for solo assignments
 * @returns Redemption result with repo details
 * @throws Various typed errors (see above)
 */
export async function redeemLink(
  link: RepoCreationLink & {
    org_name: string;
    installation_id: number;
  },
  authContext: AuthContext,
  choice: TeamChoice,
  customSlug?: string
): Promise<RedemptionResult> {
  // 1. Validate link
  validateLinkActive(link);

  // 2. Validate org membership
  await validateOrgMembership(
    link.org_name,
    authContext.login
  );

  // 3. Check for duplicate redemption (idempotency)
  const existing = await hasStudentRedeemed(
    link.id,
    authContext.githubId
  );

  if (existing) {
    throw new AlreadyRedeemedError();
  }

  // 4. Get authenticated clients
  const appOctokit = await getInstallationOctokit(
    link.installation_id
  );
  const userOctokit = getOctokitForUser(
    authContext.accessToken
  );

  // 5. Resolve team (for group assignments)
  const team = await resolveTeam(
    link,
    choice,
    appOctokit,
    link.org_name
  );

  // 6. Determine repo name and slug
  let repoName: string;
  let repoSlug: string;

  if (link.link_type === "solo") {
    repoSlug = customSlug || authContext.login;
    repoName = buildRepoName(
      link.assessment_name,
      repoSlug
    );
  } else {
    if (!team) {
      throw new Error(
        "Team must be resolved for group assignments"
      );
    }

    repoSlug = team.team_name;
    repoName = buildRepoName(
      link.assessment_name,
      repoSlug
    );
  }

  // 7. Ensure repo exists
  const repo = await ensureRepo(
    appOctokit,
    link.org_name,
    repoName,
    link.template_repo
  );

  // 8. Grant access
  if (link.link_type === "solo") {
    // Solo: add user directly as collaborator
    await grantAccess(
      appOctokit,
      userOctokit,
      link.org_name,
      repo.name,
      authContext.login,
      link.access_level
    );
  } else {
    // Group: create/update team and grant team access
    if (!team) {
      throw new Error("Team must exist for group assignment");
    }

    // Create GitHub team if not already created
    if (!team.github_team_id) {
      const githubTeamId = await createGitHubTeam(
        appOctokit,
        link.org_name,
        team.team_name
      );

      await updateTeamGithubId(team.id, githubTeamId);
      team.github_team_id = githubTeamId;
    }

    // Add user to GitHub team
    const teamSlug = teamNameToSlug(team.team_name);

    await addTeamMember(
      appOctokit,
      link.org_name,
      teamSlug,
      authContext.login,
      "member"
    );

    // Grant team access to repo (idempotent)
    await grantTeamRepoAccess(
      appOctokit,
      link.org_name,
      teamSlug,
      repo.name,
      toGitHubPermission(link.access_level)
    );

    // Record team repo on first member (idempotent)
    if (!team.repo_name) {
      await setTeamRepo(team.id, repo.name, repo.htmlUrl);
    }
  }

  // 9. Record redemption
  await createStudentRepoAccess(
    link.id,
    authContext.githubId,
    repo.name,
    repo.htmlUrl,
    link.access_level,
    team?.id,
    authContext.login
  );

  return {
    repoName: repo.name,
    repoUrl: repo.htmlUrl,
    cloneUrl: repo.cloneUrl,
    teamId: team?.id,
    alreadyRedeemed: false,
  };
}

/**
 * Get redemption data for display (after successful redemption).
 *
 * This is a convenience function to fetch the full context
 * for a redemption page. It includes real GitHub member counts.
 */
export interface RedemptionPageData {
  link: RepoCreationLink & { org_name: string; installation_id: number };
  teams: (Team & { memberCount: number })[];
  membership: "active" | "pending" | "none";
  existingRedemption?: {
    repoName: string;
    repoUrl: string;
    cloneUrl: string;
  };
}

export async function getRedemptionPageData(
  link: RepoCreationLink & { org_name: string; installation_id: number },
  authContext: AuthContext | null
): Promise<RedemptionPageData> {
  let membership: "active" | "pending" | "none" = "none";

  if (authContext) {
    membership = await getOrgMembershipState(
      link.org_name,
      authContext.login
    );
  }

  let teams: (Team & { memberCount: number })[] = [];

  if (link.link_type === "group") {
    const dbTeams = await getTeamsByLink(link.id);

    // Get GitHub member counts for each team
    const appOctokit = await getInstallationOctokit(
      link.installation_id
    );

    teams = await Promise.all(
      dbTeams.map(async (team) => {
        let memberCount = 0;

        // Only query GitHub if we have a github_team_id
        if (team.github_team_id) {
          const teamSlug = teamNameToSlug(team.team_name);
          memberCount = await getGitHubTeamMemberCount(
            appOctokit,
            link.org_name,
            teamSlug
          );
        }

        return {
          ...team,
          memberCount,
        };
      })
    );
  }

  let existingRedemption: {
    repoName: string;
    repoUrl: string;
    cloneUrl: string;
  } | undefined;

  if (authContext) {
    const access = await getStudentRedemption(
      link.id,
      authContext.githubId
    );

    if (access) {
      existingRedemption = {
        repoName: access.repo_name,
        repoUrl: access.repo_url,
        cloneUrl: `git clone ${access.repo_url}`,
      };
    }
  }

  return {
    link,
    teams,
    membership,
    existingRedemption,
  };
}
