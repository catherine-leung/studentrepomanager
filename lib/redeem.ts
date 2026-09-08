// lib/redeem.ts

import type { Octokit } from "@octokit/rest";
import type { AuthContext } from "./session";
import type { RepoCreationLink, Team } from "./types";
import {
  getTeamsByLink,
  getTeamById,
  getTeamMemberCount as getDbTeamMemberCount,
  createTeam,
  updateTeamGithubId,
  setTeamRepo,
  createStudentRepoAccess,
  hasStudentRedeemed,
  getStudentRedemption,
  isRepoNameTakenOnLink,
  TeamNameTakenError,
  reserveGroupSlot,
  releaseGroupSlot,
} from "@/lib/db";
import {
  buildRepoName,
  ensureRepo,
  grantAccess,
  createGitHubTeam,
  addTeamMember,
  grantTeamRepoAccess,
  toGitHubPermission,
  slugifyTeamName,
  getTeamMemberCount as getGitHubTeamMemberCount,
  buildGitHubTeamName,
} from "./github-repos";
import { getInstallationOctokit } from "./github-app";
import {
  isOrgMember,
  getOrgMembershipState,
  type MembershipState,
} from "./org-membership";

export { TeamNameTakenError };

type LinkWithOrg = RepoCreationLink & {
  org_name: string;
  installation_id: number;
};

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

export class RepoNameTakenError extends Error {
  constructor(repoName: string) {
    super(
      `A repository named '${repoName}' already exists for ` +
      "this assignment. Please choose a different name."
    );
    this.name = "RepoNameTakenError";
  }
}

export class MaxGroupsReachedError extends Error {
  constructor() {
    super(
      "The maximum number of groups for this assignment " +
      "has been reached. No new groups can be created."
    );
    this.name = "MaxGroupsReachedError";
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * The slug used for all GitHub team API calls.
 *
 * Prefers the slug GitHub actually assigned (recorded when the
 * team was created). Falls back to our approximation only for
 * teams that have not been created on GitHub yet.
 */
function getTeamSlug(team: Team): string {
  return team.github_team_slug ?? slugifyTeamName(team.team_name);
}

/**
 * Resolve the current member count for a team.
 *
 * GitHub is the source of truth (it reflects manual changes
 * made outside the app). If the team has no GitHub team yet,
 * or GitHub cannot be read, fall back to the DB count instead
 * of silently reporting 0 — a 0 would make a full team look
 * joinable.
 */
async function resolveTeamMemberCount(
  octokit: Octokit,
  org: string,
  team: Team
): Promise<number> {
  const dbCount = await getDbTeamMemberCount(team.id);

  if (!team.github_team_id) {
    return dbCount;
  }

  try {
    return await getGitHubTeamMemberCount(
      octokit,
      org,
      getTeamSlug(team)
    );
  } catch (error) {
    console.error(
      `Falling back to DB member count for team ${team.id} ` +
      `(${org}/${getTeamSlug(team)}):`,
      error
    );
    return dbCount;
  }
}

// ============================================================================
// VALIDATION
// ============================================================================

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

async function validateOrgMembership(
  installationId: number,
  orgName: string,
  username: string
): Promise<void> {
  const isMember = await isOrgMember(
    installationId,
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
 * Resolve a team choice to a Team row.
 *
 * - teamId: validate it belongs to this link and has capacity
 * - newTeamName: validate size, reject slug collisions, create
 * - solo/coursedocs links: no-op (returns undefined)
 *
 * @throws InvalidTeamChoiceError, TeamNotFoundError,
 *   TeamFullError, TeamNameTakenError, MaxGroupsReachedError
 */
async function resolveTeam(
  link: RepoCreationLink,
  choice: TeamChoice,
  octokit: Octokit,
  orgName: string
): Promise<Team | undefined> {
  if (link.link_type !== "group") {
    return undefined;
  }

  // JOINING EXISTING TEAM
  if (choice.teamId !== undefined) {
    const team = await getTeamById(choice.teamId);

    if (!team) {
      throw new TeamNotFoundError(choice.teamId);
    }

    if (team.link_id !== link.id) {
      throw new InvalidTeamChoiceError(
        "Team does not belong to this assignment"
      );
    }

    const memberCount = await resolveTeamMemberCount(
      octokit,
      orgName,
      team
    );

    const capacity =
      team.expected_team_size ??
      link.max_team_size ??
      Number.POSITIVE_INFINITY;

    if (memberCount >= capacity) {
      throw new TeamFullError();
    }

    // JUST RETURN THE TEAM - DO NOT CREATE ANYTHING
    return team;
  }

  // CREATING NEW TEAM
  if (!choice.newTeamName) {
    throw new InvalidTeamChoiceError(
      "Team ID or new team name is required for group assignments"
    );
  }

  const newTeamName = choice.newTeamName;

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
      "Expected team size cannot exceed the maximum of " +
      `${link.max_team_size}`
    );
  }

  const newSlug = slugifyTeamName(newTeamName);

  if (!newSlug) {
    throw new InvalidTeamChoiceError(
      "Team name must contain at least one letter or number"
    );
  }

  // Reject names that differ only in case/punctuation from an
  // existing team *within this link*. They would collide on
  // the generated repository name.
  const existingTeams = await getTeamsByLink(link.id);

  const collision = existingTeams.some(
    (team) =>
      slugifyTeamName(team.team_name) === newSlug ||
      team.github_team_slug === newSlug
  );

  if (collision) {
    throw new TeamNameTakenError(newTeamName);
  }

  // Atomically reserve a group slot. The UPDATE is the arbiter
  // of whether we've hit max_groups.
  const reserved = await reserveGroupSlot(link.id);

  if (!reserved) {
    throw new MaxGroupsReachedError();
  }

  try {
    // createTeam throws TeamNameTakenError on a unique
    // violation, which covers the race where two students
    // submit the same name at the same time within this link.
    return await createTeam(
      link.id,
      newTeamName,
      choice.expectedTeamSize
    );
  } catch (error) {
    // Release the slot if team creation failed
    await releaseGroupSlot(link.id);
    throw error;
  }
}

// ============================================================================
// COURSEDOCS REDEMPTION
// ============================================================================

/**
 * Coursedocs: the team and repo already exist. Add the student
 * to the team (idempotent on GitHub's side) and record access.
 */
async function redeemCoursedocs(
  link: LinkWithOrg,
  authContext: AuthContext
): Promise<RedemptionResult> {
  // For coursedocs, there's exactly one team (created at link creation)
  const teams = await getTeamsByLink(link.id);

  if (teams.length === 0) {
    throw new Error(
      "Coursedocs link has no team. Please contact your instructor."
    );
  }

  const team = teams[0];

  if (!team.github_team_slug || !team.repo_name || !team.repo_url) {
    throw new Error(
      "Coursedocs team is not fully provisioned. " +
      "Please contact your instructor."
    );
  }

  const appOctokit = await getInstallationOctokit(
    link.installation_id
  );

  // Add student to the pre-created team
  await addTeamMember(
    appOctokit,
    link.org_name,
    team.github_team_slug,
    authContext.login,
    "member"
  );

  // Record access to the pre-created repo
  await createStudentRepoAccess(
    link.id,
    authContext.githubId,
    team.repo_name,
    team.repo_url,
    "read",
    team.id,
    authContext.login
  );

  return {
    repoName: team.repo_name,
    repoUrl: team.repo_url,
    cloneUrl: `git clone ${team.repo_url}`,
    teamId: team.id,
    alreadyRedeemed: false,
    linkType: "coursedocs",
  };
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
  linkType: "solo" | "group" | "coursedocs";
}

/**
 * Redeem an assignment link for a student.
 *
 * 1. Validate the link (active, not expired)
 * 2. Check org membership
 * 3. Check for duplicate redemption (idempotency)
 * 4. For coursedocs: add to team and record access
 * 5. For solo/group: resolve team, create/fetch repo, grant access
 * 6. Record redemption
 */
export async function redeemLink(
  link: LinkWithOrg,
  authContext: AuthContext,
  choice: TeamChoice,
  customSlug?: string
): Promise<RedemptionResult> {
  // 1. Validate link
  validateLinkActive(link);

  // 2. Validate org membership
  await validateOrgMembership(
    link.installation_id,
    link.org_name,
    authContext.login
  );

  // 3. Idempotency
  const existing = await hasStudentRedeemed(
    link.id,
    authContext.githubId
  );

  if (existing) {
    throw new AlreadyRedeemedError();
  }

  // 4. Coursedocs: nothing to create, just join the team
  if (link.link_type === "coursedocs") {
    return redeemCoursedocs(link, authContext);
  }

  // 5. Solo/group: create clients and resolve team
  const appOctokit = await getInstallationOctokit(
    link.installation_id
  );

  const team = await resolveTeam(
    link,
    choice,
    appOctokit,
    link.org_name
  );

  let repoName: string;

  if (link.link_type === "solo") {
    repoName = buildRepoName(
      link.assessment_name,
      customSlug || authContext.login
    );

    // Another student on this link may already own a repo
    // with this name (same custom slug, or slugs that
    // collapse to the same value). Never hand out access to
    // someone else's repository.
    if (await isRepoNameTakenOnLink(link.id, repoName)) {
      throw new RepoNameTakenError(repoName);
    }
  } else {
    if (!team) {
      throw new Error(
        "Team must be resolved for group assignments"
      );
    }

    repoName = buildRepoName(
      link.assessment_name,
      team.team_name
    );
  }

  // 6. Ensure repo exists
  const repo = await ensureRepo(
    appOctokit,
    link.org_name,
    repoName,
    link.template_repo
  );

  // 7. Grant access
  if (link.link_type === "solo") {
    await grantAccess(
      appOctokit,
      link.org_name,
      repo.name,
      authContext.login,
      link.access_level
    );
  } else {
    if (!team) {
      throw new Error("Team must exist for group assignment");
    }

    // Create the GitHub team on first redemption and record
    // the slug GitHub assigned. The team name includes the
    // link ID to ensure uniqueness org-wide.
    if (!team.github_team_id) {
      const githubTeamName = buildGitHubTeamName(
        link.link_id,
        team.team_name
      );

      const githubTeam = await createGitHubTeam(
        appOctokit,
        link.org_name,
        githubTeamName
      );

      await updateTeamGithubId(
        team.id,
        githubTeam.id,
        githubTeam.slug
      );

      team.github_team_id = githubTeam.id;
      team.github_team_slug = githubTeam.slug;
    }

    const teamSlug = getTeamSlug(team);

    await addTeamMember(
      appOctokit,
      link.org_name,
      teamSlug,
      authContext.login,
      "member"
    );

    // Idempotent
    await grantTeamRepoAccess(
      appOctokit,
      link.org_name,
      teamSlug,
      repo.name,
      toGitHubPermission(link.access_level)
    );

    // First member records the repo (idempotent)
    if (!team.repo_name) {
      await setTeamRepo(team.id, repo.name, repo.htmlUrl);
    }
  }

  // 8. Record redemption
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
    cloneUrl: `git clone ${repo.htmlUrl}`,
    teamId: team?.id,
    alreadyRedeemed: false,
    linkType: link.link_type,
  };
}

// ============================================================================
// PAGE DATA
// ============================================================================

/**
 * The subset of a link that is safe to send to the browser.
 *
 * `max_groups` / `current_groups` let the redemption page hide
 * the "Create New Team" form once the professor's group limit
 * has been reached. The server still enforces the limit in
 * resolveTeam(); this is purely a UX hint.
 */
export interface PublicLink {
  id: number;
  link_id: string;
  assessment_name: string;
  link_type: "solo" | "group" | "coursedocs";
  access_level: "read" | "write" | "admin";
  max_team_size: number | null;
  max_groups: number | null;
  current_groups: number;
  expires_at: string | null;
  is_active: boolean;
  org_name: string;
}

export interface RedemptionPageData {
  link: PublicLink;
  teams: (Team & { memberCount: number })[];
  membership: MembershipState;
  existingRedemption?: {
    repoName: string;
    repoUrl: string;
    cloneUrl: string;
  };
}

function toPublicLink(link: LinkWithOrg): PublicLink {
  return {
    id: link.id,
    link_id: link.link_id,
    assessment_name: link.assessment_name,
    link_type: link.link_type,
    access_level: link.access_level,
    max_team_size: link.max_team_size,
    max_groups: link.max_groups,
    current_groups: link.current_groups,
    expires_at: link.expires_at,
    is_active: link.is_active,
    org_name: link.org_name,
  };
}

export async function getRedemptionPageData(
  link: LinkWithOrg,
  authContext: AuthContext | null
): Promise<RedemptionPageData> {
  let membership: MembershipState = "none";

  if (authContext) {
    membership = await getOrgMembershipState(
      link.installation_id,
      link.org_name,
      authContext.login
    );
  }

  let teams: (Team & { memberCount: number })[] = [];

  // Only load teams for group assignments, NOT coursedocs
  if (link.link_type === "group") {
    const dbTeams = await getTeamsByLink(link.id);

    const appOctokit = await getInstallationOctokit(
      link.installation_id
    );

    teams = await Promise.all(
      dbTeams.map(async (team) => ({
        ...team,
        memberCount: await resolveTeamMemberCount(
          appOctokit,
          link.org_name,
          team
        ),
      }))
    );
  }

  let existingRedemption:
    | RedemptionPageData["existingRedemption"]
    | undefined;

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
    link: toPublicLink(link),
    teams,
    membership,
    existingRedemption,
  };
}
