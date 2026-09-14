// components/LinksList.tsx

"use client";

import { useEffect, useState } from "react";
import { RepoCreationLink } from "@/lib/types";
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
      <div className="text-gray-600">
        Loading links...
      </div>
    );
  }

  if (error) {
    return <div className="text-red-600">{error}</div>;
  }

  if (links.length === 0) {
    return (
      <div className="text-gray-600">
        {COPY.dashboard.noLinks}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">
        {COPY.dashboard.title}
      </h2>
      {links.map((link) => (
        <LinkCard
          key={link.id}
          link={link}
          onDelete={handleDelete}
          onStatusChange={handleStatusChange}
        />
      ))}
    </div>
  );
}
