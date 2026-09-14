// components/LinkDetails.tsx

"use client";

import { useEffect, useState } from "react";
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
}

interface Props {
  linkId: string;
}

export function LinkDetails({ linkId }: Props) {
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
      <div className="mt-4 text-gray-600">Loading...</div>
    );
  }

  if (error) {
    return (
      <div className="mt-4 text-red-600">{error}</div>
    );
  }

  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded">
          <p className="text-gray-600 text-sm">
            {COPY.dashboard.stats.totalRedemptions}
          </p>
          <p className="text-2xl font-bold">
            {stats?.totalRedemptions || 0}
          </p>
        </div>
        <div className="bg-green-50 p-4 rounded">
          <p className="text-gray-600 text-sm">
            {COPY.dashboard.stats.totalRepos}
          </p>
          <p className="text-2xl font-bold">
            {stats?.totalRepos || 0}
          </p>
        </div>
        <div className="bg-purple-50 p-4 rounded">
          <p className="text-gray-600 text-sm">
            {COPY.dashboard.stats.totalLinks}
          </p>
          <p className="text-2xl font-bold">
            {stats?.totalTeams || 0}
          </p>
        </div>
      </div>

      {redemptions.length > 0 && (
        <div>
          <h4 className="font-bold mb-3">
            {COPY.dashboard.stats.totalRedemptions}
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left">
                    GitHub Username
                  </th>
                  <th className="px-4 py-2 text-left">
                    Repository
                  </th>
                  <th className="px-4 py-2 text-left">
                    {COPY.linkCard.accessLevel}
                  </th>
                  <th className="px-4 py-2 text-left">
                    {COPY.linkCard.created}
                  </th>
                </tr>
              </thead>
              <tbody>
                {redemptions.map((r, i) => (
                  <tr
                    key={i}
                    className="border-b border-gray-200
                               hover:bg-gray-50"
                  >
                    <td className="px-4 py-2">
                      {r.github_login || "(unknown)"}
                    </td>
                    <td className="px-4 py-2">
                      <a
                        href={r.repo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {r.repo_name}
                      </a>
                    </td>
                    <td className="px-4 py-2 capitalize">
                      {r.access_level}
                    </td>
                    <td className="px-4 py-2">
                      {new Date(
                        r.created_at
                      ).toLocaleDateString()}
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
