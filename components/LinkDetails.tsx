// components/LinkDetails.tsx

"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { COPY } from "@/lib/copy";

interface LinkStats {
  totalRedemptions: number;
  totalRepos: number;
  totalTeams: number;
}

interface Redemption {
  github_login: string | null;
  repo_name: string;
  repo_url: string;
  access_level: string;
  created_at: string;
  team_name: string | null;
}

interface TeamGroup {
  teamName: string | null;
  repoName: string;
  repoUrl: string;
  members: Redemption[];
}

function formatRedeemedAt(isoString: string): string {
  return new Date(isoString).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function groupByTeam(redemptions: Redemption[]): TeamGroup[] {
  const groups: TeamGroup[] = [];
  const indexByTeam = new Map<string, number>();

  for (const r of redemptions) {
    const key = r.team_name ?? `__ungrouped_${r.repo_name}`;
    const existingIndex = indexByTeam.get(key);

    if (existingIndex !== undefined) {
      groups[existingIndex].members.push(r);
      continue;
    }

    indexByTeam.set(key, groups.length);
    groups.push({
      teamName: r.team_name,
      repoName: r.repo_name,
      repoUrl: r.repo_url,
      members: [r],
    });
  }

  return groups;
}

interface Props {
  linkId: string;
  /** Group-only stat (teams created) is hidden for other types. */
  linkType?: "solo" | "group" | "coursedocs";
}

const BASE_STAT_TILES: Array<{
  key: keyof LinkStats;
  label: string;
  accent: string;
}> = [
  {
    key: "totalRedemptions",
    label: COPY.dashboard.stats.totalRedemptions,
    accent: "bg-primary-50 text-primary-700",
  },
  {
    key: "totalRepos",
    label: COPY.dashboard.stats.totalRepos,
    accent: "bg-success/10 text-success",
  },
];

const TEAMS_STAT_TILE = {
  key: "totalTeams" as const,
  label: COPY.dashboard.stats.teamsCreated,
  accent: "bg-accent-50 text-accent-700",
};

export function LinkDetails({ linkId, linkType }: Props) {
  const [stats, setStats] = useState<LinkStats | null>(null);
  const [redemptions, setRedemptions] = useState<
    Redemption[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDetails() {
      try {
        const response = await fetch(
          `/api/links/${linkId}/stats`
        );

        if (!response.ok) {
          throw new Error(COPY.errors.failedToFetch);
        }

        const data = await response.json();
        setStats(data.stats);
        setRedemptions(data.redemptions);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : COPY.errors.serverError
        );
      } finally {
        setLoading(false);
      }
    }

    fetchDetails();
  }, [linkId]);

  if (loading) {
    return (
      <div
        className="mt-3 flex items-center gap-2 text-sm
                   text-neutral-500"
        role="status"
      >
        <div
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full
                     border-2 border-neutral-200
                     border-t-primary-600"
        />
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-3">
        <Alert type="error" message={error} />
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-neutral-200 pt-3">
      <div
        className={`mb-4 grid gap-3 ${
          linkType === "group" ? "grid-cols-3" : "grid-cols-2"
        }`}
      >
        {[
          ...BASE_STAT_TILES,
          ...(linkType === "group" ? [TEAMS_STAT_TILE] : []),
        ].map((tile) => (
          <div
            key={tile.key}
            className={`rounded-lg p-3 ${tile.accent}`}
          >
            <p className="text-xs font-medium opacity-80">
              {tile.label}
            </p>
            <p className="text-xl font-bold">
              {stats?.[tile.key] ?? 0}
            </p>
          </div>
        ))}
      </div>

      {redemptions.length > 0 && linkType === "group" && (
        <div>
          <h4
            className="mb-2 text-sm font-semibold
                       text-neutral-700"
          >
            {COPY.dashboard.stats.totalRedemptions} by team
          </h4>
          <div className="space-y-3">
            {groupByTeam(redemptions).map((team) => (
              <div
                key={team.teamName ?? team.repoUrl}
                className="overflow-hidden rounded-lg border
                           border-neutral-200"
              >
                <div
                  className="flex items-center justify-between
                             gap-3 bg-neutral-50 px-3 py-2"
                >
                  <h5 className="text-sm font-semibold
                                 text-neutral-900">
                    {team.teamName ?? "Ungrouped"}
                  </h5>
                  <a
                    href={team.repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-xs font-medium
                               text-primary-600
                               hover:text-primary-700
                               hover:underline"
                  >
                    {team.repoName}
                  </a>
                </div>
                <ul className="divide-y divide-neutral-100">
                  {team.members.map((r, i) => (
                    <li
                      key={i}
                      className="flex items-center
                                 justify-between gap-3 px-3
                                 py-2 text-sm"
                    >
                      <span className="text-neutral-900">
                        {r.github_login || "(unknown)"}
                      </span>
                      <span
                        className="shrink-0 text-xs
                                   text-neutral-500"
                      >
                        <span className="capitalize">
                          {r.access_level}
                        </span>
                        {" · "}
                        {formatRedeemedAt(r.created_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {redemptions.length > 0 && linkType !== "group" && (
        <div>
          <h4
            className="mb-2 text-sm font-semibold
                       text-neutral-700"
          >
            {COPY.dashboard.stats.totalRedemptions}
          </h4>
          <div
            className="overflow-x-auto rounded-lg border
                       border-neutral-200"
          >
            <table className="w-full text-sm">
              <thead className="bg-neutral-50">
                <tr>
                  <th
                    className="px-3 py-2 text-left text-xs
                               font-semibold uppercase
                               tracking-wide text-neutral-500"
                  >
                    GitHub Username
                  </th>
                  <th
                    className="px-3 py-2 text-left text-xs
                               font-semibold uppercase
                               tracking-wide text-neutral-500"
                  >
                    Repository
                  </th>
                  <th
                    className="px-3 py-2 text-left text-xs
                               font-semibold uppercase
                               tracking-wide text-neutral-500"
                  >
                    {COPY.linkCard.accessLevel}
                  </th>
                  <th
                    className="px-3 py-2 text-left text-xs
                               font-semibold uppercase
                               tracking-wide text-neutral-500"
                  >
                    Redeemed
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {redemptions.map((r, i) => (
                  <tr key={i} className="hover:bg-neutral-50">
                    <td className="px-3 py-2 text-neutral-900">
                      {r.github_login || "(unknown)"}
                    </td>
                    <td className="px-3 py-2">
                      <a
                        href={r.repo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600
                                   hover:text-primary-700
                                   hover:underline"
                      >
                        {r.repo_name}
                      </a>
                    </td>
                    <td
                      className="px-3 py-2 capitalize
                                 text-neutral-700"
                    >
                      {r.access_level}
                    </td>
                    <td className="px-3 py-2 text-neutral-700">
                      {formatRedeemedAt(r.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
