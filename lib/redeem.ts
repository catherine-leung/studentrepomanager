// lib/redeem.ts

import "server-only";

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
  deleteTeam,
} from "@/lib/db";
import {
  buildRepoName,
  getRepo,
  createRepo,
  grantAccess,
  createGitHubTeam,
  addTeamMember,
  grantTeamRepoAccess,
  toGitHubPermission,
  slugifyTeamName,
  getTeamMemberCount as getGitHubTeamMemberCount,
  buildGitHubTeamName,
  RepoExistsError,
  deleteRepo,
  deleteGitHubTeam,
  type RepoInfo,
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

export class TeamNotReadyError extends Error {
  constructor() {
    super(
      "This team is still being set up. " +
      "Please try again in a few seconds."
    );
    this.name = "TeamNotReadyError";
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
      `A repository named '${repoName}' already exists in ` +
      "the organization. Please choose a different name."
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
// ROLLBACK HELPERS
// ============================================================================

interface RedemptionRollbackTarget {
  repo: RepoInfo | null;
  team?: Team;
}

/**
 * Undo everything *this request* created. Never touches
 * resources that existed before the request started.
 *
 * Used when redemption fails partway through. Cleans up:
 * - Repo created by this request
 * - GitHub team created by this request
 * - Team DB row created by this request
 * - Group slot reserved by this request
 *
 * Never throws; logs failures so the professor can clean up
 * manually if needed.
 */
async function rollbackRedemption(
  octokit: Octokit,
  link: LinkWithOrg,
  created: RedemptionRollbackTarget
): Promise<void> {
  const tasks: Array<[string, Promise<unknown>]> = [];

  if (created.repo) {
    tasks.push([
      `repo ${link.org_name}/${created.repo.name}`,
      deleteRepo(octokit, link.org_name, created.repo.name),
    ]);
  }

  if (created.team) {
    if (created.team.github_team_slug) {
      tasks.push([
        `GitHub team ${link.org_name}/${created.team.github_team_slug}`,
        deleteGitHubTeam(
          octokit,
          link.org_name,
          created.team.github_team_slug
        ),
      ]);
    }

    tasks.push([
      `team DB row ${created.team.id}`,
      deleteTeam(created.team.id),
    ]);

    tasks.push([
      `group slot for link ${link.link_id}`,
      releaseGroupSlot(link.id),
    ]);
  }

  const results = await Promise.allSettled(
    tasks.map(([, p]) => p)
  );

  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(
        `Redemption rollback failed for ${tasks[i][0]}:`,
        r.reason
      );
    }
  });
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

interface ResolvedTeam {
  team: Team;
  createdHere: boolean;
}

/**
 * Resolve a team choice to a Team row.
 *
 * - teamId: validate it belongs to this link, is ready,
 *   and has capacity
 * - newTeamName: validate size, reject slug collisions,
 *   create
 * - solo/coursedocs links: no-op (returns undefined)
 *
 * @throws InvalidTeamChoiceError, TeamNotFoundError,
 *   TeamFullError, TeamNameTakenError, MaxGroupsReachedError,
 *   TeamNotReadyError
 */
async function resolveTeam(
  link: RepoCreationLink,
  choice: TeamChoice,
  octokit: Octokit,
  orgName: string
): Promise<ResolvedTeam | undefined> {
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

    // Refuse to join a team that isn't provisioned yet
    // (repo_name is NULL). This prevents a race where
    // another student's repo creation fails and deletes
    // the team row.
    if (!team.repo_name) {
      throw new TeamNotReadyError();
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
    return { team, createdHere: false };
  }

  // CREATING NEW TEAM
  if (!choice.newTeamName) {
    throw new InvalidTeamChoiceError(
      "Team ID or new team name is required for group " +
      "assignments"
    );
  }

  const newTeamName = choice.newTeamName;

  if (!choice.expectedTeamSize) {
    throw new InvalidTeamChoiceError(
      "Expected team size is required when creating a " +
      "new team"
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
    return {
      team: await createTeam(
        link.id,
        newTeamName,
        choice.expectedTeamSize
      ),
      createdHere: true,
    };
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
  // For coursedocs, there's exactly one team (created at link
  // creation)
  const teams = await getTeamsByLink(link.id);

  if (teams.length === 0) {
    throw new Error(
      "Coursedocs link has no team. Please contact your " +
      "instructor."
    );
  }

  const team = teams[0];

  if (
    !team.github_team_slug ||
    !team.repo_name ||
    !team.repo_url
  ) {
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
 * 5. For solo/group: resolve team, create/fetch repo,
 *    grant access
 * 6. Record redemption
 *
 * Security: repos are only created by the app, never
 * pre-existing. A name collision is a hard error.
 *
 * Rollback: if repo creation succeeds but later steps fail,
 * the repo is deleted so the name can be reused on retry.
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

  const resolved = await resolveTeam(
    link,
    choice,
    appOctokit,
    link.org_name
  );

  const team = resolved?.team;
  const ownedTeam = resolved?.createdHere ? team : undefined;

  let repoName = "";
  let createdRepoHere: RepoInfo | null = null;

  try {
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

    // 6. Resolve the repository
    let repo: RepoInfo;

    if (team?.repo_name) {
      // Later members of a group reuse the team's repo.
      const existing = await getRepo(
        appOctokit,
        link.org_name,
        team.repo_name
      );

      if (!existing) {
        throw new Error(
          `Team repository ${team.repo_name} is missing`
        );
      }

      repo = existing;
    } else {
      // Solo, or first member of a group: the name must be
      // free. If it is not, the repo belongs to someone else
      // (another link, or the professor). Do not touch it.
      repo = await createRepo(
        appOctokit,
        link.org_name,
        repoName,
        link.template_repo
      );
      createdRepoHere = repo;

      // Record immediately so a failure later in this request
      // does not leave the team without a repo reference.
      if (team) {
        await setTeamRepo(team.id, repo.name, repo.htmlUrl);
      }
    }

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
  } catch (error) {
    await rollbackRedemption(appOctokit, link, {
      repo: createdRepoHere,
      team: ownedTeam,
    });

    if (error instanceof RepoExistsError) {
      throw new RepoNameTakenError(repoName);
    }

    throw error;
  }
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

/**
 * Fetch page data for the redemption page.
 *
 * For authenticated users, load teams and existing redemption.
 * For unauthenticated users, only load link metadata (no GitHub
 * calls to avoid rate-limit burn).
 *
 * For group links, only load teams if the user is an active org
 * member (no point showing teams to someone who can't join).
 */
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

  // Only load teams for group assignments, NOT coursedocs.
  // Only load if the user is an active member (no point
  // showing teams to someone who can't join, and it saves
  // GitHub API calls for unauthenticated visitors).
  if (
    link.link_type === "group" &&
    membership === "active"
  ) {
    const dbTeams = await getTeamsByLink(link.id);

    teams = await Promise.all(
      dbTeams.map(async (team) => ({
        ...team,
        memberCount: await getDbTeamMemberCount(team.id),
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
