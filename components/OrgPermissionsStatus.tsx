// components/OrgPermissionsStatus.tsx

"use client";

import { useEffect, useState } from "react";

type BasePermission =
  | "none"
  | "read"
  | "write"
  | "admin"
  | "unknown";

interface PermissionsData {
  orgName: string;
  basePermission: BasePermission;
  isCorrect: boolean;
  settingsUrl: string;
  instructions: string[];
}

interface Props {
  orgName: string;
}

function dismissKey(orgName: string): string {
  return `perm-banner-dismissed:${orgName}`;
}

export function OrgPermissionsStatus({ orgName }: Props) {
  const [data, setData] = useState<PermissionsData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setDismissed(
      sessionStorage.getItem(dismissKey(orgName)) === "1"
    );
  }, [orgName]);

  useEffect(() => {
    let cancelled = false;

    async function fetchPermissions() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/orgs/${encodeURIComponent(orgName)}/permissions`,
          { cache: "no-store" }
        );
        const json = await response.json();

        if (!response.ok) {
          throw new Error(
            json.error || "Failed to check permissions"
          );
        }

        if (!cancelled) {
          setData(json as PermissionsData);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to check permissions"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchPermissions();

    return () => {
      cancelled = true;
    };
  }, [orgName, refreshKey]);

  function handleDismiss() {
    sessionStorage.setItem(dismissKey(orgName), "1");
    setDismissed(true);
  }

  function handleRecheck() {
    sessionStorage.removeItem(dismissKey(orgName));
    setDismissed(false);
    setRefreshKey((k) => k + 1);
  }

  if (loading) {
    return (
      <div className="mb-6 text-sm text-gray-500">
        Checking organization base permissions...
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="mb-6 p-4 bg-gray-50 border border-gray-200
                   rounded text-sm text-gray-700"
      >
        Could not check base permissions: {error}
      </div>
    );
  }

  if (!data) {
    return null;
  }

  if (data.isCorrect) {
    return (
      <div
        className="mb-6 p-3 bg-green-50 border border-green-200
                   rounded text-sm text-green-800 flex
                   justify-between items-center"
      >
        <span>
          ✓ Base permissions for{" "}
          <span className="font-mono">{data.orgName}</span>{" "}
          are set to <strong>None</strong>. Students will
          only see repositories they are granted.
        </span>
        <button
          onClick={handleRecheck}
          className="text-green-800 underline text-xs"
        >
          Re-check
        </button>
      </div>
    );
  }

  if (dismissed) {
    return null;
  }

  const isUnknown = data.basePermission === "unknown";

  return (
    <div
      className={
        "mb-6 p-4 border rounded " +
        (isUnknown
          ? "bg-yellow-50 border-yellow-300"
          : "bg-red-50 border-red-300")
      }
    >
      <div className="flex justify-between items-start mb-3">
        <h3
          className={
            "font-bold " +
            (isUnknown ? "text-yellow-900" : "text-red-900")
          }
        >
          {isUnknown
            ? "Base permissions could not be verified"
            : "Base permissions are not set to None"}
        </h3>
        <button
          onClick={handleDismiss}
          className="text-sm text-gray-600 hover:underline"
          aria-label="Dismiss for this session"
        >
          Dismiss
        </button>
      </div>

      <p className="text-sm text-gray-800 mb-4">
        {isUnknown ? (
          <>
            GitHub did not return the base permission for{" "}
            <span className="font-mono">{data.orgName}</span>.
            Please verify it manually.
          </>
        ) : (
          <>
            <span className="font-mono">{data.orgName}</span>{" "}
            currently grants every member{" "}
            <strong className="capitalize">
              {data.basePermission}
            </strong>{" "}
            access to all repositories. Students would be able
            to see each other&apos;s work.
          </>
        )}
      </p>

      <div className="bg-white rounded p-4 mb-4 border border-gray-200">
        <p className="text-sm text-gray-700 mb-3">
          <strong>Recommendation:</strong> Set base permissions
          to <strong>None</strong> so students only see
          repositories you explicitly grant them access to.
        </p>

        <a
          href={data.settingsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-4 py-2 bg-blue-600 text-white
                     rounded hover:bg-blue-700 transition font-medium
                     text-sm"
        >
          Go to Organization Settings →
        </a>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleRecheck}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300
                     rounded transition text-sm font-medium"
        >
          Re-check
        </button>
      </div>
    </div>
  );
}
