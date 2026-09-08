// lib/coursedocs.ts

import type { Octokit } from "@octokit/rest";
import {
  createTeam,
  updateTeamGithubId,
  setTeamRepo,
  generateLinkId,
} from "@/lib/db";
import {
  buildRepoName,
  buildGitHubTeamName,
  createGitHubTeam,
  ensureRepo,
  grantTeamRepoAccess,
  repoExists,
  deleteGitHubTeam,
  deleteRepo,
} from "./github-repos";
import { getInstallationOctokit } from "./github-app";

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

  // Check if repo already exists
  if (await repoExists(octokit, input.orgName, repoName)) {
    throw new CoursedocsRepoExistsError(
      input.orgName,
      repoName
    );
  }

  let teamSlug: string | null = null;
  let createdRepo: string | null = null;

  try {
    // 1. Create GitHub team
    const githubTeam = await createGitHubTeam(
      octokit,
      input.orgName,
      buildGitHubTeamName(input.linkId, teamName)
    );
    teamSlug = githubTeam.slug;

    // 2. Create repository
    const repo = await ensureRepo(
      octokit,
      input.orgName,
      repoName,
      null
    );
    createdRepo = repo.name;

    // 3. Grant team read access to repo
    await grantTeamRepoAccess(
      octokit,
      input.orgName,
      githubTeam.slug,
      repo.name,
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
    await setTeamRepo(team.id, repo.name, repo.htmlUrl);
  } catch (error) {
    await rollbackGitHub(
      octokit,
      input.orgName,
      teamSlug,
      createdRepo
    );
    throw error;
  }
}
