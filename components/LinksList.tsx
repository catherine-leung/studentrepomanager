// components/LinksList.tsx

"use client";

import { useEffect, useState } from "react";
import { RepoCreationLink } from "@/lib/types";
import { Alert } from "@/components/ui/Alert";
import { LinkCard } from "./LinkCard";
import { COPY } from "@/lib/copy";

interface Props {
  orgName: string;
  refreshTrigger: number;
}

export function LinksList({
  orgName,
  refreshTrigger,
}: Props) {
  const [links, setLinks] = useState<RepoCreationLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLinks() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/links?org=${encodeURIComponent(orgName)}`
        );

        if (!response.ok) {
          throw new Error(COPY.errors.failedToFetch);
        }

        const data = await response.json();
        setLinks(data);
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

    if (orgName) {
      fetchLinks();
    }
  }, [orgName, refreshTrigger]);

  function handleDelete(linkId: string) {
    setLinks((prev) =>
      prev.filter((l) => l.link_id !== linkId)
    );
  }

  function handleStatusChange(
    linkId: string,
    newStatus: boolean
  ) {
    setLinks((prev) =>
      prev.map((l) =>
        l.link_id === linkId ? { ...l, is_active: newStatus } : l
      )
    );
  }

  if (loading) {
    return (
      <div
        className="flex items-center gap-2 text-sm
                   text-neutral-500"
        role="status"
      >
        <div
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full
                     border-2 border-neutral-200
                     border-t-primary-600"
        />
        Loading links…
      </div>
    );
  }

  if (error) {
    return <Alert type="error" message={error} />;
  }

  if (links.length === 0) {
    return (
      <div
        className="rounded-xl border border-dashed
                   border-neutral-300 bg-white p-8 text-center
                   text-sm text-neutral-500"
      >
        {COPY.dashboard.noLinks}
      </div>
    );
  }

  const activeCount = links.filter((l) => l.is_active).length;

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-lg font-bold text-neutral-900">
          {COPY.dashboard.title}
        </h2>
        <span className="text-sm text-neutral-500">
          {activeCount} of {links.length} active
        </span>
      </div>
      <div
        className="divide-y divide-neutral-100 overflow-hidden
                   rounded-xl border border-neutral-200 bg-white
                   shadow-sm"
      >
        {links.map((link) => (
          <LinkCard
            key={link.id}
            link={link}
            onDelete={handleDelete}
            onStatusChange={handleStatusChange}
          />
        ))}
      </div>
    </div>
  );
}
