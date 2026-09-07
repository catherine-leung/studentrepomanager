import { neon } from "@neondatabase/serverless";
import { randomBytes } from "crypto";
import {
  Organization,
  RepoCreationLink,
  Team,
  StudentRepoAccess,
} from "./types";

const sql = neon(process.env.DATABASE_URL!);

function first<T>(rows: readonly unknown[]): T | null {
  return rows.length > 0
    ? (rows[0] as T)
    : null;
}

function many<T>(rows: readonly unknown[]): T[] {
  return rows as T[];
}

export class RepoLinkNotFoundError extends Error {
  constructor() {
    super("Assignment link not found");
    this.name = "RepoLinkNotFoundError";
  }
}

export class RepoLinkHasRedemptionsError extends Error {
  constructor() {
    super(
      "This assignment link has redemptions and can only be deactivated"
    );
    this.name = "RepoLinkHasRedemptionsError";
  }
}

// ============================================================================
// ORGANIZATIONS
// ============================================================================

export async function getOrganizationByName(
  orgName: string
): Promise<Organization | null> {
  try {
    const result = await sql`
      SELECT *
      FROM organizations
      WHERE org_name = ${orgName}
    `;

    return first<Organization>(result);
  } catch (error) {
    console.error("Error getting organization:", error);
    throw error;
  }
}

export async function getOrganizationById(
  orgId: number
): Promise<Organization | null> {
  try {
    const result = await sql`
      SELECT *
      FROM organizations
      WHERE id = ${orgId}
    `;

    return first<Organization>(result);
  } catch (error) {
    console.error("Error getting organization:", error);
    throw error;
  }
}

export async function createOrganization(
  orgName: string,
  installationId: number
): Promise<Organization> {
  const result = await sql`
    INSERT INTO organizations (
      org_name,
      installation_id,
      created_at,
      updated_at
    )
    VALUES (
      ${orgName},
      ${installationId},
      NOW(),
      NOW()
    )
    ON CONFLICT (org_name) DO UPDATE
      SET installation_id = ${installationId},
          updated_at = NOW()
    RETURNING *
  `;

  const organization = first<Organization>(result);

  if (!organization) {
    throw new Error("Failed to create organization");
  }

  return organization;
}

export async function updateOrganizationInstallation(
  orgName: string,
  installationId: number
): Promise<Organization> {
  try {
    const result = await sql`
      UPDATE organizations
      SET installation_id = ${installationId},
          last_verified_at = CURRENT_TIMESTAMP
      WHERE org_name = ${orgName}
      RETURNING *
    `;

    const organization = first<Organization>(result);

    if (!organization) {
      throw new Error(
        "Organization was not found while updating installation"
      );
    }

    return organization;
  } catch (error) {
    console.error(
      "Error updating organization installation:",
      error
    );
    throw error;
  }
}

// ============================================================================
// REPO CREATION LINKS
// ============================================================================

export async function createRepoLink(
  orgId: number,
  linkType: "solo" | "group",
  accessLevel: "read" | "write" | "admin",
  createdByUsername: string,
  templateRepo?: string,
  maxTeamSize?: number,
  expiresAt?: Date,
  assessmentName?: string
): Promise<RepoCreationLink> {
  try {
    // Generate 8-char random string (6 bytes → 8 base64url chars)
    const linkId = randomBytes(6).toString("base64url");

    const finalAssessmentName =
      assessmentName &&
      assessmentName.trim().length > 0
        ? assessmentName.trim()
        : "Assignment";

    const result = await sql`
      INSERT INTO repo_creation_links (
        org_id,
        link_id,
        link_type,
        template_repo,
        access_level,
        max_team_size,
        created_by_username,
        expires_at,
        assessment_name
      )
      VALUES (
        ${orgId},
        ${linkId},
        ${linkType},
        ${templateRepo || null},
        ${accessLevel},
        ${maxTeamSize || null},
        ${createdByUsername},
        ${expiresAt || null},
        ${finalAssessmentName}
      )
      RETURNING *
    `;

    const link = first<RepoCreationLink>(result);

    if (!link) {
      throw new Error("Failed to create repository link");
    }

    return link;
  } catch (error) {
    console.error("Error creating repo link:", error);
    throw error;
  }
}

export async function getRepoLinksByOrg(
  orgId: number
): Promise<RepoCreationLink[]> {
  try {
    const result = await sql`
      SELECT *
      FROM repo_creation_links
      WHERE org_id = ${orgId}
      ORDER BY created_at DESC
    `;

    return many<RepoCreationLink>(result);
  } catch (error) {
    console.error("Error getting repo links:", error);
    throw error;
  }
}

export async function getRepoLinkById(
  linkId: string
): Promise<RepoCreationLink | null> {
  try {
    const result = await sql`
      SELECT *
      FROM repo_creation_links
      WHERE link_id = ${linkId}
    `;

    return first<RepoCreationLink>(result);
  } catch (error) {
    console.error("Error getting repo link:", error);
    throw error;
  }
}

export async function getRepoLinkByIdWithOrg(
  linkId: string
): Promise<
  (RepoCreationLink & { org_name: string; installation_id: number }) | null
> {
  try {
    const result = await sql`
      SELECT
        rcl.*,
        o.org_name,
        o.installation_id
      FROM repo_creation_links AS rcl
      JOIN organizations AS o
        ON rcl.org_id = o.id
      WHERE rcl.link_id = ${linkId}
    `;

    return first<
      RepoCreationLink & { org_name: string; installation_id: number }
    >(result);
  } catch (error) {
    console.error("Error getting repo link with org:", error);
    throw error;
  }
}

export async function updateRepoLinkStatus(
  linkId: string,
  isActive: boolean
): Promise<RepoCreationLink> {
  try {
    const result = await sql`
      UPDATE repo_creation_links
      SET is_active = ${isActive}
      WHERE link_id = ${linkId}
      RETURNING *
    `;

    const link = first<RepoCreationLink>(result);

    if (!link) {
      throw new RepoLinkNotFoundError();
    }

    return link;
  } catch (error) {
    console.error("Error updating repo link:", error);
    throw error;
  }
}

export async function deleteRepoLink(
  linkId: string
): Promise<void> {
  try {
    const deleted = await sql`
      DELETE FROM repo_creation_links AS link
      WHERE link.link_id = ${linkId}
        AND NOT EXISTS (
          SELECT 1
          FROM student_repo_access AS access
          WHERE access.link_id = link.id
        )
      RETURNING link.id
    `;

    if (deleted.length > 0) {
      return;
    }

    const existing = await sql`
      SELECT id
      FROM repo_creation_links
      WHERE link_id = ${linkId}
    `;

    if (existing.length === 0) {
      throw new RepoLinkNotFoundError();
    }

    throw new RepoLinkHasRedemptionsError();
  } catch (error) {
    if (
      error instanceof RepoLinkNotFoundError ||
      error instanceof RepoLinkHasRedemptionsError
    ) {
      throw error;
    }

    console.error("Error deleting link:", error);
    throw error;
  }
}

export async function isLinkExpired(
  linkId: string
): Promise<boolean> {
  try {
    const result = await sql`
      SELECT (
        expires_at IS NOT NULL
        AND expires_at < CURRENT_TIMESTAMP
      ) AS is_expired
      FROM repo_creation_links
      WHERE link_id = ${linkId}
    `;

    return result.length > 0
      ? Boolean(result[0].is_expired)
      : true;
  } catch (error) {
    console.error("Error checking link expiration:", error);
    throw error;
  }
}

// ============================================================================
// TEAMS
// ============================================================================

export async function createTeam(
  linkId: number,
  teamName: string,
  expectedTeamSize: number,
  githubTeamId?: number
): Promise<Team> {
  try {
    const result = await sql`
      INSERT INTO teams (
        link_id,
        team_name,
        expected_team_size,
        github_team_id
      )
      VALUES (
        ${linkId},
        ${teamName},
        ${expectedTeamSize},
        ${githubTeamId || null}
      )
      RETURNING *
    `;

    const team = first<Team>(result);

    if (!team) {
      throw new Error("Failed to create team");
    }

    return team;
  } catch (error) {
    console.error("Error creating team:", error);
    throw error;
  }
}

export async function getTeamsByLink(
  linkId: number
): Promise<Team[]> {
  try {
    const result = await sql`
      SELECT *
      FROM teams
      WHERE link_id = ${linkId}
      ORDER BY created_at DESC
    `;

    return many<Team>(result);
  } catch (error) {
    console.error("Error getting teams:", error);
    throw error;
  }
}

export async function getTeamById(
  teamId: number
): Promise<Team | null> {
  try {
    const result = await sql`
      SELECT *
      FROM teams
      WHERE id = ${teamId}
    `;

    return first<Team>(result);
  } catch (error) {
    console.error("Error getting team:", error);
    throw error;
  }
}

export async function getTeamMemberCount(
  teamId: number
): Promise<number> {
  try {
    const result = await sql`
      SELECT COUNT(*) AS count
      FROM student_repo_access
      WHERE team_id = ${teamId}
    `;

    return Number(result[0]?.count) || 0;
  } catch (error) {
    console.error("Error getting team member count:", error);
    throw error;
  }
}

export async function updateTeamGithubId(
  teamId: number,
  githubTeamId: number
): Promise<Team> {
  try {
    const result = await sql`
      UPDATE teams
      SET github_team_id = ${githubTeamId}
      WHERE id = ${teamId}
      RETURNING *
    `;

    const team = first<Team>(result);

    if (!team) {
      throw new Error("Team was not found");
    }

    return team;
  } catch (error) {
    console.error("Error updating team GitHub ID:", error);
    throw error;
  }
}

// ============================================================================
// TEAM REPO MANAGEMENT
// ============================================================================

/**
 * Set the repository name and URL for a team.
 *
 * Idempotent: only updates if repo_name is currently NULL.
 * This ensures the first member to redeem records the repo,
 * and subsequent members don't overwrite it.
 *
 * @param teamId Team ID
 * @param repoName Repository name
 * @param repoUrl Repository URL
 * @returns Updated team, or null if already set
 */
export async function setTeamRepo(
  teamId: number,
  repoName: string,
  repoUrl: string
): Promise<Team | null> {
  try {
    const result = await sql`
      UPDATE teams
      SET repo_name = ${repoName},
          repo_url = ${repoUrl}
      WHERE id = ${teamId}
        AND repo_name IS NULL
      RETURNING *
    `;

    return first<Team>(result);
  } catch (error) {
    console.error("Error setting team repo:", error);
    throw error;
  }
}

/**
 * Get a team by name within a link.
 *
 * @param linkId Link ID
 * @param teamName Team name
 * @returns Team if found, null otherwise
 */
export async function getTeamByName(
  linkId: number,
  teamName: string
): Promise<Team | null> {
  try {
    const result = await sql`
      SELECT *
      FROM teams
      WHERE link_id = ${linkId}
        AND team_name = ${teamName}
    `;

    return first<Team>(result);
  } catch (error) {
    console.error("Error getting team by name:", error);
    throw error;
  }
}

/**
 * Get all teams for a link with member counts.
 *
 * @param linkId Link ID
 * @returns Array of teams with member counts
 */
export async function getTeamsWithMemberCounts(
  linkId: number
): Promise<
  (Team & { memberCount: number })[]
> {
  try {
    const result = await sql`
      SELECT
        t.*,
        COUNT(sra.id) AS member_count
      FROM teams AS t
      LEFT JOIN student_repo_access AS sra
        ON t.id = sra.team_id
      WHERE t.link_id = ${linkId}
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `;

    return many<Team & { memberCount: number }>(
      result.map((row: any) => ({
        ...row,
        memberCount: Number(row.member_count),
      }))
    );
  } catch (error) {
    console.error(
      "Error getting teams with member counts:",
      error
    );
    throw error;
  }
}

// ============================================================================
// STUDENT REPO ACCESS
// ============================================================================

/**
 * Create or update student repository access.
 *
 * Extended version that includes github_login.
 *
 * @param linkId Link ID
 * @param githubId GitHub user ID
 * @param repoName Repository name
 * @param repoUrl Repository URL
 * @param accessLevel Access level (read, write, admin)
 * @param teamId Optional team ID (for group assignments)
 * @param githubLogin GitHub username
 * @returns Created/updated access record
 */
export async function createStudentRepoAccess(
  linkId: number,
  githubId: number,
  repoName: string,
  repoUrl: string,
  accessLevel: "read" | "write" | "admin",
  teamId?: number,
  githubLogin?: string
): Promise<StudentRepoAccess> {
  try {
    const result = await sql`
      INSERT INTO student_repo_access (
        link_id,
        github_id,
        team_id,
        repo_name,
        repo_url,
        access_level,
        github_login
      )
      VALUES (
        ${linkId},
        ${githubId},
        ${teamId || null},
        ${repoName},
        ${repoUrl},
        ${accessLevel},
        ${githubLogin || null}
      )
      ON CONFLICT (link_id, github_id)
      DO UPDATE SET
        team_id = ${teamId || null},
        repo_name = ${repoName},
        repo_url = ${repoUrl},
        access_level = ${accessLevel},
        github_login = ${githubLogin || null}
      RETURNING *
    `;

    const access = first<StudentRepoAccess>(result);

    if (!access) {
      throw new Error(
        "Failed to create student repository access"
      );
    }

    return access;
  } catch (error) {
    console.error(
      "Error creating student repo access:",
      error
    );
    throw error;
  }
}

export async function getStudentRepoAccess(
  linkId: number,
  githubId: number
): Promise<StudentRepoAccess | null> {
  try {
    const result = await sql`
      SELECT *
      FROM student_repo_access
      WHERE link_id = ${linkId}
        AND github_id = ${githubId}
    `;

    return first<StudentRepoAccess>(result);
  } catch (error) {
    console.error(
      "Error getting student repo access:",
      error
    );
    throw error;
  }
}

export async function getStudentRepoAccessByLinkId(
  linkId: number
): Promise<StudentRepoAccess[]> {
  try {
    const result = await sql`
      SELECT *
      FROM student_repo_access
      WHERE link_id = ${linkId}
      ORDER BY created_at DESC
    `;

    return many<StudentRepoAccess>(result);
  } catch (error) {
    console.error(
      "Error getting student repo access by link:",
      error
    );
    throw error;
  }
}

export async function getStudentRepoAccessByTeamId(
  teamId: number
): Promise<StudentRepoAccess[]> {
  try {
    const result = await sql`
      SELECT *
      FROM student_repo_access
      WHERE team_id = ${teamId}
      ORDER BY created_at DESC
    `;

    return many<StudentRepoAccess>(result);
  } catch (error) {
    console.error(
      "Error getting student repo access by team:",
      error
    );
    throw error;
  }
}

export async function getStudentRepoAccessByGithubId(
  githubId: number
): Promise<StudentRepoAccess[]> {
  try {
    const result = await sql`
      SELECT *
      FROM student_repo_access
      WHERE github_id = ${githubId}
      ORDER BY created_at DESC
    `;

    return many<StudentRepoAccess>(result);
  } catch (error) {
    console.error(
      "Error getting student repo access by GitHub ID:",
      error
    );
    throw error;
  }
}

// ============================================================================
// REDEMPTION CHECKS
// ============================================================================

/**
 * Check if a student has already redeemed a link.
 *
 * @param linkId Link ID
 * @param githubId GitHub user ID
 * @returns true if redeemed, false otherwise
 */
export async function hasStudentRedeemed(
  linkId: number,
  githubId: number
): Promise<boolean> {
  try {
    const result = await sql`
      SELECT COUNT(*) AS count
      FROM student_repo_access
      WHERE link_id = ${linkId}
        AND github_id = ${githubId}
    `;

    return (Number(result[0]?.count) || 0) > 0;
  } catch (error) {
    console.error(
      "Error checking student redemption:",
      error
    );
    throw error;
  }
}

/**
 * Get a student's existing redemption for a link.
 *
 * Returns the full access record if they've already redeemed,
 * or null if not.
 *
 * @param linkId Link ID
 * @param githubId GitHub user ID
 * @returns Access record if redeemed, null otherwise
 */
export async function getStudentRedemption(
  linkId: number,
  githubId: number
): Promise<StudentRepoAccess | null> {
  try {
    const result = await sql`
      SELECT *
      FROM student_repo_access
      WHERE link_id = ${linkId}
        AND github_id = ${githubId}
    `;

    return first<StudentRepoAccess>(result);
  } catch (error) {
    console.error(
      "Error getting student redemption:",
      error
    );
    throw error;
  }
}

// ============================================================================
// STATISTICS & ANALYTICS
// ============================================================================

export async function getLinkStats(
  linkId: string
): Promise<{
  totalRedemptions: number;
  totalRepos: number;
  totalTeams: number;
}> {
  try {
    const redemptions = await sql`
      SELECT COUNT(*) AS count
      FROM student_repo_access
      WHERE link_id = (
        SELECT id
        FROM repo_creation_links
        WHERE link_id = ${linkId}
      )
    `;

    const repos = await sql`
      SELECT COUNT(DISTINCT repo_name) AS count
      FROM student_repo_access
      WHERE link_id = (
        SELECT id
        FROM repo_creation_links
        WHERE link_id = ${linkId}
      )
    `;

    const teams = await sql`
      SELECT COUNT(*) AS count
      FROM teams
      WHERE link_id = (
        SELECT id
        FROM repo_creation_links
        WHERE link_id = ${linkId}
      )
    `;

    return {
      totalRedemptions:
        Number(redemptions[0]?.count) || 0,
      totalRepos:
        Number(repos[0]?.count) || 0,
      totalTeams:
        Number(teams[0]?.count) || 0,
    };
  } catch (error) {
    console.error("Error getting link stats:", error);
    throw error;
  }
}

export async function getLinkRedemptions(
  linkId: string
): Promise<StudentRepoAccess[]> {
  try {
    const result = await sql`
      SELECT sra.*
      FROM student_repo_access AS sra
      WHERE sra.link_id = (
        SELECT id
        FROM repo_creation_links
        WHERE link_id = ${linkId}
      )
      ORDER BY sra.created_at DESC
    `;

    return many<StudentRepoAccess>(result);
  } catch (error) {
    console.error("Error getting link redemptions:", error);
    throw error;
  }
}

export async function getOrgStats(
  orgId: number
): Promise<{
  totalLinks: number;
  totalRedemptions: number;
  totalRepos: number;
  activeLinks: number;
}> {
  try {
    const totalLinks = await sql`
      SELECT COUNT(*) AS count
      FROM repo_creation_links
      WHERE org_id = ${orgId}
    `;

    const totalRedemptions = await sql`
      SELECT COUNT(*) AS count
      FROM student_repo_access AS sra
      JOIN repo_creation_links AS rcl
        ON sra.link_id = rcl.id
      WHERE rcl.org_id = ${orgId}
    `;

    const totalRepos = await sql`
      SELECT COUNT(DISTINCT sra.repo_name) AS count
      FROM student_repo_access AS sra
      JOIN repo_creation_links AS rcl
        ON sra.link_id = rcl.id
      WHERE rcl.org_id = ${orgId}
    `;

    const activeLinks = await sql`
      SELECT COUNT(*) AS count
      FROM repo_creation_links
      WHERE org_id = ${orgId}
        AND is_active = true
        AND (
          expires_at IS NULL
          OR expires_at > CURRENT_TIMESTAMP
        )
    `;

    return {
      totalLinks: Number(totalLinks[0]?.count) || 0,
      totalRedemptions:
        Number(totalRedemptions[0]?.count) || 0,
      totalRepos:
        Number(totalRepos[0]?.count) || 0,
      activeLinks:
        Number(activeLinks[0]?.count) || 0,
    };
  } catch (error) {
    console.error("Error getting org stats:", error);
    throw error;
  }
}

// ============================================================================
// VALIDATION & CHECKS
// ============================================================================

export async function isLinkValid(
  linkId: string
): Promise<boolean> {
  try {
    const result = await sql`
      SELECT (
        is_active = true
        AND (
          expires_at IS NULL
          OR expires_at > CURRENT_TIMESTAMP
        )
      ) AS is_valid
      FROM repo_creation_links
      WHERE link_id = ${linkId}
    `;

    return result.length > 0
      ? Boolean(result[0].is_valid)
      : false;
  } catch (error) {
    console.error("Error checking link validity:", error);
    throw error;
  }
}

export async function canStudentJoinTeam(
  teamId: number,
  expectedTeamSize: number | null
): Promise<boolean> {
  if (!expectedTeamSize) {
    return true;
  }

  try {
    const memberCount = await getTeamMemberCount(teamId);

    return memberCount < expectedTeamSize;
  } catch (error) {
    console.error("Error checking team capacity:", error);
    throw error;
  }
}
