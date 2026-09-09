// lib/coursedocs.ts

import "server-only";

import type { Octokit } from "@octokit/rest";
import {
  createTeam,
  updateTeamGithubId,
  setTeamRepo,
} from "@/lib/db";
import {
  buildRepoName,
  buildGitHubTeamName,
  createGitHubTeam,
  createRepo,
  grantTeamRepoAccess,
  deleteGitHubTeam,
  deleteRepo,
  archiveRepo,
  type RepoInfo,
} from "./github-repos";
import { getInstallationOctokit } from "./github-app";
import type { Team } from "./types";

export class CoursedocsRepoExistsError extends Error {
  constructor(org: string, repoName: string) {
    super(
      `A repository named '${repoName}' already exists in ` +
      `'${org}'. Choose a different assessment name or ` +
      "remove the existing repository."
    );
    this.name = "CoursedocsRepoExistsError";
  }
}

export interface ProvisionCoursedocsInput {
  linkDbId: number;
  linkId: string;
  orgName: string;
  installationId: number;
  assessmentName: string;
}

/**
 * Best-effort cleanup of GitHub resources created during a
 * failed provisioning attempt. Never throws; logs failures so
 * the professor can remove leftovers manually.
 */
async function rollbackGitHub(
  octokit: Octokit,
  org: string,
  teamSlug: string | null,
  repoName: string | null
): Promise<void> {
  const tasks: Promise<void>[] = [];

  if (teamSlug) {
    tasks.push(deleteGitHubTeam(octokit, org, teamSlug));
  }

  if (repoName) {
    tasks.push(deleteRepo(octokit, org, repoName));
  }

  const results = await Promise.allSettled(tasks);

  results.forEach((result, i) => {
    if (result.status === "rejected") {
      const target = i === 0 && teamSlug
        ? `team ${org}/${teamSlug}`
        : `repo ${org}/${repoName}`;

      console.error(
        `Coursedocs rollback failed for ${target}:`,
        result.reason
      );
    }
  });
}

/**
 * Provision a coursedocs link: create the GitHub team and
 * repository, grant team read access, and record everything
 * in the database using the teams table.
 *
 * @throws CoursedocsRepoExistsError if the derived repo name
 *   is already taken in the org
 */
export async function provisionCoursedocsLink(
  input: ProvisionCoursedocsInput
): Promise<void> {
  const octokit = await getInstallationOctokit(
    input.installationId
  );

  const teamName = input.assessmentName;
  const repoName = buildRepoName(input.assessmentName, "");

  let teamSlug: string | null = null;
  let createdRepo: RepoInfo | null = null;

  try {
    // 1. Create GitHub team
    const githubTeam = await createGitHubTeam(
      octokit,
      input.orgName,
      buildGitHubTeamName(input.linkId, teamName)
    );
    teamSlug = githubTeam.slug;

    // 2. Create repository (strict: fail if exists)
    try {
      createdRepo = await createRepo(
        octokit,
        input.orgName,
        repoName,
        null
      );
    } catch (error) {
      // createRepo throws RepoExistsError on 422
      if (error instanceof Error && error.name === "RepoExistsError") {
        throw new CoursedocsRepoExistsError(
          input.orgName,
          repoName
        );
      }
      throw error;
    }

    // 3. Grant team read access to repo
    await grantTeamRepoAccess(
      octokit,
      input.orgName,
      githubTeam.slug,
      createdRepo.name,
      "pull"
    );

    // 4. Record team in database
    const team = await createTeam(
      input.linkDbId,
      teamName,
      2147483647
    );

    // 5. Record GitHub team ID and slug
    await updateTeamGithubId(
      team.id,
      githubTeam.id,
      githubTeam.slug
    );

    // 6. Record repo on team
    await setTeamRepo(team.id, createdRepo.name, createdRepo.htmlUrl);
  } catch (error) {
    await rollbackGitHub(
      octokit,
      input.orgName,
      teamSlug,
      createdRepo?.name ?? null
    );
    throw error;
  }
}

/**
 * Best-effort removal of coursedocs GitHub resources after the
 * link row has been deleted. Never throws.
 *
 * Deletes the team and archives (renames + archives) the repo
 * so the name can be reused if the link is recreated.
 */
export async function cleanupCoursedocsResources(
  installationId: number,
  org: string,
  linkId: string,
  team: Team
): Promise<void> {
  const octokit = await getInstallationOctokit(installationId);

  const tasks: Array<[string, Promise<void>]> = [];

  if (team.github_team_slug) {
    tasks.push([
      `team ${team.github_team_slug}`,
      deleteGitHubTeam(octokit, org, team.github_team_slug),
    ]);
  }

  if (team.repo_name) {
    const archivedName = `${team.repo_name}-removed-${linkId}`;
    tasks.push([
      `repo ${team.repo_name}`,
      archiveRepo(
        octokit,
        org,
        team.repo_name,
        archivedName
      ),
    ]);
  }

  const results = await Promise.allSettled(
    tasks.map(([, p]) => p)
  );

  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(
        `Coursedocs cleanup failed for ${tasks[i][0]}:`,
        r.reason
      );
    }
  });
}
