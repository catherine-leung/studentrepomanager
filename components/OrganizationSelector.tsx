// components/OrganizationSelector.tsx

"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Alert } from "@/components/ui/Alert";
import { Select } from "@/components/ui/Select";
import { recordSeenOrgs } from "@/lib/org-welcome-tracker";
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
    const userLogin = session?.user?.login;
    let cancelled = false;

    async function fetchOrgs(options: { silent: boolean }) {
      if (!userLogin) {
        if (!options.silent) {
          setLoading(false);
        }
        return;
      }

      if (!options.silent) {
        setLoading(true);
      }

      try {
        const response = await fetch("/api/orgs/installed");

        if (!response.ok) {
          const data = await response.json();
          throw new Error(
            data.error || COPY.errors.failedToFetch
          );
        }

        const data = (await response.json()) as Organization[];

        if (cancelled) {
          return;
        }

        setOrgs(data);
        setError(null);
        recordSeenOrgs(data.map((org) => org.login));
      } catch (err) {
        if (cancelled) {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : COPY.errors.serverError
        );
        setOrgs([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchOrgs({ silent: false });

    // "+ Add Organization" opens GitHub's install flow in a new
    // tab, so this tab's org list won't include it until we
    // check again. Refetch (quietly, no loading spinner) when
    // this tab regains focus, so coming back from that tab
    // picks up the new org without a manual reload.
    function handleFocus() {
      fetchOrgs({ silent: true });
    }

    window.addEventListener("focus", handleFocus);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleFocus);
    };
  }, [session?.user?.login]);

  const appSlug = getAppSlug();

  if (loading) {
    return (
      <div
        className="mb-6 flex items-center gap-2
                   text-sm text-neutral-500"
        role="status"
      >
        <span
          aria-hidden="true"
          className="h-3.5 w-3.5 animate-spin rounded-full
                     border-2 border-neutral-300
                     border-t-primary-600"
        />
        Loading organizations…
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-6">
        <Alert
          type="error"
          title="Couldn't load organizations"
          message={error}
        />
        <p className="mt-2 text-sm text-neutral-600">
          Make sure the GitHub App is installed in at least
          one organization.{" "}
          <a
            href={
              `https://github.com/apps/${appSlug}` +
              "/installations"
            }
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary-600
                       hover:text-primary-700
                       focus-visible:outline-none
                       focus-visible:ring-2
                       focus-visible:ring-primary-500
                       focus-visible:ring-offset-2
                       rounded-sm"
          >
            Manage app installations →
          </a>
        </p>
      </div>
    );
  }

  if (orgs.length === 0) {
    return (
      <div className="mb-6">
        <Alert
          type="warning"
          title="No organizations with the app installed"
          message={
            "Install the GitHub App in your organization " +
            "to get started."
          }
        />
        <p className="mt-2 text-sm text-neutral-600">
          <a
            href={
              `https://github.com/apps/${appSlug}` +
              "/installations/new"
            }
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary-600
                       hover:text-primary-700
                       focus-visible:outline-none
                       focus-visible:ring-2
                       focus-visible:ring-primary-500
                       focus-visible:ring-offset-2
                       rounded-sm"
          >
            Install app in organization →
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="mb-6 max-w-sm">
      <Select
        label="Select organization"
        value={selectedOrg || ""}
        onChange={(e) => onSelect(e.target.value)}
        hint={
          `Showing ${orgs.length} organization` +
          `${orgs.length !== 1 ? "s" : ""} with the app ` +
          "installed"
        }
        options={[
          { value: "", label: "— Choose an organization —" },
          ...orgs.map((org) => ({
            value: org.login,
            label: org.login,
          })),
        ]}
      />
    </div>
  );
}
