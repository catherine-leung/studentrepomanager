// components/OrganizationSelector.tsx

"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { COPY } from "@/lib/copy";

interface Organization {
  login: string;
  id: number;
  installation_id: number;
}

interface Props {
  onSelect: (orgName: string) => void;
  selectedOrg: string | null;
}

function getAppSlug(): string {
  return (
    process.env.NEXT_PUBLIC_GITHUB_APP_SLUG ||
    "student-repo-manager"
  );
}

export function OrganizationSelector({
  onSelect,
  selectedOrg,
}: Props) {
  const { data: session } = useSession();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOrgs() {
      if (!session?.user?.login) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/orgs/installed");

        if (!response.ok) {
          const data = await response.json();
          throw new Error(
            data.error || COPY.errors.failedToFetch
          );
        }

        const data = await response.json();

        setOrgs(data);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : COPY.errors.serverError
        );
        setOrgs([]);
      } finally {
        setLoading(false);
      }
    }

    fetchOrgs();
  }, [session?.user?.login]);

  const appSlug = getAppSlug();

  if (loading) {
    return (
      <div className="text-gray-600">
        Loading organizations...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 p-4 bg-red-50 rounded mb-6">
        <p className="font-bold">
          Error loading organizations:
        </p>
        <p>{error}</p>
        <p className="text-sm mt-2">
          Make sure the GitHub App is installed in at least
          one organization.
        </p>
        <p className="text-sm mt-2">
          <a
            href={`https://github.com/apps/${appSlug}/installations`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            Manage app installations →
          </a>
        </p>
      </div>
    );
  }

  if (orgs.length === 0) {
    return (
      <div className="text-gray-600 p-4 bg-yellow-50 rounded mb-6">
        <p className="font-bold">
          No organizations with app installed
        </p>
        <p>
          Install the GitHub App in your organizations
          to get started.
        </p>
        <p className="text-sm mt-2">
          <a
            href={`https://github.com/apps/${appSlug}/installations/new`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            Install app in organization →
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <label className="block text-sm font-medium mb-2">
        Select Organization
      </label>
      <select
        value={selectedOrg || ""}
        onChange={(e) => onSelect(e.target.value)}
        className="w-full px-4 py-2 border border-gray-300
                   rounded-lg focus:outline-none
                   focus:ring-2 focus:ring-blue-500"
      >
        <option value="">-- Choose an organization --</option>
        {orgs.map((org) => (
          <option key={org.id} value={org.login}>
            {org.login}
          </option>
        ))}
      </select>
      <p className="text-xs text-gray-500 mt-2">
        Showing {orgs.length} organization
        {orgs.length !== 1 ? "s" : ""} with app installed
      </p>
    </div>
  );
}
