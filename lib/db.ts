import "server-only";

import { neon } from "@neondatabase/serverless";
import { randomBytes } from "crypto";
import {
  Organization,
  RepoCreationLink,
  Team,
  StudentRepoAccess,
  RedemptionWithTeam,
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

/**
 * Postgres unique_violation (SQLSTATE 23505).
 */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "23505"
  );
}

export class RepoLinkNotFoundError extends Error {
  constructor() {
    super("Link not found");
    this.name = "RepoLinkNotFoundError";
  }
}

export class RepoLinkHasRedemptionsError extends Error {
  constructor() {
    super(
      "This link has redemptions and can only " +
      "be deactivated"
    );
    this.name = "RepoLinkHasRedemptionsError";
  }
}

export class TeamNameTakenError extends Error {
  constructor(teamName: string) {
    super(
      `A team named '${teamName}' already exists for this ` +
      "link. Please choose a different name."
    );
    this.name = "TeamNameTakenError";
  }
}

export class AssessmentNameTakenError extends Error {
  constructor(assessmentName: string) {
    super(
      `A link named '${assessmentName}' already ` +
      "exists in this organization. Please choose a " +
      "different name."
    );
    this.name = "AssessmentNameTakenError";
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
      ORDER BY updated_at DESC
      LIMIT 1
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
  try {
    // Case 1: reinstall — same org name, new installation_id.
    // Update the existing row to use the new installation ID.
    const updated = await sql`
      UPDATE organizations
      SET installation_id = ${installationId},
          updated_at = NOW()
      WHERE org_name = ${orgName}
      RETURNING *
    `;

    const existing = first<Organization>(updated);

    if (existing) {
      return existing;
    }

    // Case 2: brand-new org, or rename — same installation_id,
    // new org name (ON CONFLICT updates the name in place).
    const inserted = await sql`
      INSERT INTO organizations (
        org_name,
        installation_id,
        created_at,
        updated_at
      )
      VALUES (${orgName}, ${installationId}, NOW(), NOW())
      ON CONFLICT (installation_id) DO UPDATE
        SET org_name = ${orgName},
            updated_at = NOW()
      RETURNING *
    `;

    const organization = first<Organization>(inserted);

    if (!organization) {
      throw new Error("Failed to create organization");
    }

    return organization;
  } catch (error) {
    console.error("Error creating organization:", error);
    throw error;
  }
}

// ============================================================================
// LINK ID GENERATION
// ============================================================================

/**
 * Generate an 8-char random link ID (6 bytes → base64url).
 */
export function generateLinkId(): string {
  return randomBytes(6).toString("base64url");
}

// ============================================================================
// REPO CREATION LINKS
// ============================================================================

/**
 * Check if an assessment name already exists for an org.
 * Comparison is case-insensitive to prevent collisions
 * when slugified (e.g., "Lab 1" and "lab 1" both → "lab-1").
 *
 * Returns true if it does, false otherwise.
 */
export async function assessmentNameExists(
  orgId: number,
  assessmentName: string
): Promise<boolean> {
  try {
    const result = await sql`
      SELECT 1
      FROM repo_creation_links
      WHERE org_id = ${orgId}
        AND LOWER(assessment_name) = LOWER(${assessmentName})
      LIMIT 1
    `;

    return result.length > 0;
  } catch (error) {
    console.error(
      "Error checking assessment name:",
      error
    );
    throw error;
  }
}

/**
 * Create a new assignment link.
 *
 * @throws AssessmentNameTakenError if the org already has a
 *   link with this assessment name, regardless of link_type
 */
export async function createRepoLink(
  orgId: number,
  linkType: "solo" | "group" | "coursedocs",
  accessLevel: "read" | "write" | "admin",
  createdByUsername: string,
  templateRepo?: string,
  maxTeamSize?: number,
  expiresAt?: Date,
  assessmentName?: string,
  maxGroups?: number
): Promise<RepoCreationLink> {
  const linkId = generateLinkId();

  const finalAssessmentName =
    assessmentName &&
    assessmentName.trim().length > 0
      ? assessmentName.trim()
      : "Untitled Link";

  // Check if assessment name already exists for this org
  const exists = await assessmentNameExists(
    orgId,
    finalAssessmentName
  );

  if (exists) {
    throw new AssessmentNameTakenError(finalAssessmentName);
  }

  try {
    const result = await sql`
      INSERT INTO repo_creation_links (
        org_id,
        link_id,
        link_type,
        template_repo,
        access_level,
        max_team_size,
        max_groups,
        current_groups,
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
        ${maxGroups || null},
        ${linkType === "coursedocs" ? 1 : 0},
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
  | (RepoCreationLink & {
      org_name: string;
      installation_id: number;
    })
  | null
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
      RepoCreationLink & {
        org_name: string;
        installation_id: number;
      }
    >(result);
  } catch (error) {
    console.error(
      "Error getting repo link with org:",
      error
    );
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

/**
 * Create a team for a link.
 *
 * @throws TeamNameTakenError if (link_id, team_name) already
 *   exists (unique constraint violation, e.g. lost a race)
 */
export async function createTeam(
  linkId: number,
  teamName: string,
  expectedTeamSize: number
): Promise<Team> {
  try {
    const result = await sql`
      INSERT INTO teams (
        link_id,
        team_name,
        expected_team_size
      )
      VALUES (
        ${linkId},
        ${teamName},
        ${expectedTeamSize}
      )
      RETURNING *
    `;

    const team = first<Team>(result);

    if (!team) {
      throw new Error("Failed to create team");
    }

    return team;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new TeamNameTakenError(teamName);
    }

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

/**
 * Record the GitHub team ID and the slug GitHub assigned.
 *
 * The slug is what every subsequent GitHub call keys on, so
 * we store the real one rather than re-deriving it.
 */
export async function updateTeamGithubId(
  teamId: number,
  githubTeamId: number,
  githubTeamSlug: string
): Promise<Team> {
  try {
    const result = await sql`
      UPDATE teams
      SET github_team_id = ${githubTeamId},
          github_team_slug = ${githubTeamSlug}
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

/**
 * Set the repository name and URL for a team.
 *
 * Idempotent: only updates if repo_name is currently NULL.
 * This ensures the first member to redeem records the repo,
 * and subsequent members don't overwrite it.
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
 * Get all teams for a link with DB-side member counts.
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
      result.map((row) => {
        const team = row as Team & {
          member_count: string | number;
        };

        return {
          ...team,
          memberCount: Number(team.member_count),
        };
      })
    );
  } catch (error) {
    console.error(
      "Error getting teams with member counts:",
      error
    );
    throw error;
  }
}

/**
 * Delete a team by ID. Used for rollback when team creation
 * fails after the row was inserted.
 */
export async function deleteTeam(teamId: number): Promise<void> {
  try {
    await sql`DELETE FROM teams WHERE id = ${teamId}`;
  } catch (error) {
    console.error("Error deleting team:", error);
    throw error;
  }
}

// ============================================================================
// STUDENT REPO ACCESS
// ============================================================================

/**
 * Create or update student repository access.
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

/**
 * Check whether a repo name is already claimed on this link,
 * either by a student redemption or by a team.
 *
 * Used to stop one student from being granted access to
 * another student's repository via a colliding slug.
 */
export async function isRepoNameTakenOnLink(
  linkId: number,
  repoName: string
): Promise<boolean> {
  try {
    const result = await sql`
      SELECT 1 AS taken
      FROM student_repo_access
      WHERE link_id = ${linkId}
        AND repo_name = ${repoName}
      UNION ALL
      SELECT 1 AS taken
      FROM teams
      WHERE link_id = ${linkId}
        AND repo_name = ${repoName}
      LIMIT 1
    `;

    return result.length > 0;
  } catch (error) {
    console.error(
      "Error checking repo name availability:",
      error
    );
    throw error;
  }
}

// ============================================================================
// REDEMPTION CHECKS
// ============================================================================

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
// ATOMIC GROUP SLOT RESERVATION
// ============================================================================

/**
 * Atomically reserve one group slot. Returns false if the
 * link is already at max_groups.
 *
 * This uses a conditional UPDATE to ensure only max_groups
 * callers can succeed, preventing race conditions where two
 * students both create teams and exceed the limit.
 *
 * @param linkId Database ID of the link
 * @returns true if slot was reserved, false if max reached
 */
export async function reserveGroupSlot(
  linkId: number
): Promise<boolean> {
  try {
    const result = await sql`
      UPDATE repo_creation_links
      SET current_groups = current_groups + 1
      WHERE id = ${linkId}
        AND (
          max_groups IS NULL
          OR current_groups < max_groups
        )
      RETURNING id
    `;

    return result.length > 0;
  } catch (error) {
    console.error("Error reserving group slot:", error);
    throw error;
  }
}

/**
 * Release a group slot if team creation failed after
 * reserving. Uses GREATEST to prevent negative counts.
 *
 * @param linkId Database ID of the link
 */
export async function releaseGroupSlot(
  linkId: number
): Promise<void> {
  try {
    await sql`
      UPDATE repo_creation_links
      SET current_groups = GREATEST(current_groups - 1, 0)
      WHERE id = ${linkId}
    `;
  } catch (error) {
    console.error("Error releasing group slot:", error);
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
): Promise<RedemptionWithTeam[]> {
  try {
    // Left-joined with teams so group-type links can show who
    // redeemed under which team, not just a flat list of names.
    const result = await sql`
      SELECT sra.*, t.team_name
      FROM student_repo_access AS sra
      LEFT JOIN teams AS t ON t.id = sra.team_id
      WHERE sra.link_id = (
        SELECT id
        FROM repo_creation_links
        WHERE link_id = ${linkId}
      )
      ORDER BY t.team_name ASC NULLS LAST, sra.created_at DESC
    `;

    return many<RedemptionWithTeam>(result);
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

/**
 * Deactivate all assignment links for an organization.
 *
 * Used when the app is uninstalled from an org, so students
 * don't get 500s when trying to redeem with a stale
 * installation ID. Instead, they get a clean 403 "link is
 * inactive".
 *
 * @param orgName Organization name
 */
export async function deactivateLinksForOrg(
  orgName: string
): Promise<void> {
  try {
    await sql`
      UPDATE repo_creation_links AS rcl
      SET is_active = false
      FROM organizations AS o
      WHERE rcl.org_id = o.id
        AND o.org_name = ${orgName}
    `;
  } catch (error) {
    console.error(
      `Error deactivating links for org ${orgName}:`,
      error
    );
    throw error;
  }
}
