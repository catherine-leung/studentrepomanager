import { Octokit } from "@octokit/rest";

export function getOctokitForUser(
  accessToken: string
): Octokit {
  if (!accessToken) {
    throw new Error("GitHub user access token is required");
  }

  return new Octokit({
    auth: accessToken,
  });
}
