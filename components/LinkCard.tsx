// components/LinkCard.tsx

"use client";

import { useState } from "react";
import { RepoCreationLink } from "@/lib/types";
import { LinkDetails } from "./LinkDetails";

interface Props {
  link: RepoCreationLink;
  onDelete?: (linkId: string) => void;
  onStatusChange?: (linkId: string, newStatus: boolean) => void;
}

export function LinkCard({
  link,
  onDelete,
  onStatusChange,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const isExpired =
    link.expires_at !== null &&
    new Date(link.expires_at) < new Date();

  const isAdmin = link.access_level === "admin";
  const isActive = link.is_active;

  const typeLabel = {
    solo: "Individual",
    group: "Group",
    coursedocs: "Course Documents",
  }[link.link_type];

  const borderColor = isActive ? "#3b82f6" : "#d1d5db";

  async function handleToggleStatus() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/links/${link.link_id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            isActive: !isActive,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(
          data.error || "Failed to update link"
        );
      }

      onStatusChange?.(link.link_id, !isActive);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unknown error"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    const isCoursedocs = link.link_type === "coursedocs";

    const message =
      "Delete this link permanently? Links with " +
      "redemptions cannot be deleted and must be " +
      "deactivated instead." +
      (isCoursedocs
        ? "\n\nThe shared repository will be archived " +
          "and renamed to free the name."
        : "");

    const confirmed = confirm(message);

    if (!confirmed) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/links/${link.link_id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const data = await response.json();

        throw new Error(
          data.error || "Failed to delete link"
        );
      }

      onDelete?.(link.link_id);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unknown error"
      );
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard() {
    if (typeof window === "undefined") return;
    
    const url = `${window.location.origin}/redeem/${link.link_id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch((err) => {
      console.error("Failed to copy:", err);
      setError("Failed to copy URL to clipboard");
    });
  }


  return (
    <div
      className="bg-white rounded-lg shadow p-6 border-l-4"
      style={{ borderLeftColor: borderColor }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-bold">
              {link.assessment_name}
            </h3>
            <span
              className="px-2 py-1 text-xs font-medium
                         rounded-full bg-blue-100 text-blue-800"
            >
              {typeLabel}
            </span>
            {isAdmin && (
              <span
                className="px-2 py-1 text-xs font-medium
                           rounded-full bg-red-100 text-red-800"
              >
                Admin Access
              </span>
            )}
            {isExpired && (
              <span
                className="px-2 py-1 text-xs font-medium
                           rounded-full bg-gray-100 text-gray-800"
              >
                Expired
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600">
            Link ID:{" "}
            <span className="font-mono">{link.link_id}</span>
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleToggleStatus}
            disabled={loading || isExpired}
            className="px-3 py-1 text-sm font-medium
                       rounded bg-gray-200 hover:bg-gray-300
                       transition disabled:bg-gray-100
                       disabled:text-gray-400"
          >
            {isActive ? "Deactivate" : "Activate"}
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="px-3 py-1 text-sm font-medium
                       rounded bg-red-200 hover:bg-red-300
                       transition disabled:bg-gray-100
                       disabled:text-gray-400"
          >
            Delete
          </button>
        </div>
      </div>

      {error && (
        <div
          className="mb-4 p-3 bg-red-50 border
                     border-red-200 rounded text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <div className="mb-4 p-3 bg-gray-50 rounded">
        <p className="text-xs text-gray-600 mb-2">
          Redemption URL
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={
              typeof window !== "undefined"
                ? `${window.location.origin}/redeem/${link.link_id}`
                : ""
            }
            readOnly
            className="flex-1 px-4 py-2 border
                       border-gray-300 rounded text-sm
                       bg-white font-mono"
          />
          <button
            onClick={copyToClipboard}
            className="px-4 py-2 bg-blue-600 text-white
                       text-sm rounded hover:bg-blue-700
                       transition font-medium whitespace-nowrap"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Share this link with students
        </p>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-4 text-sm">
        <div>
          <p className="text-gray-600">Type</p>
          <p className="font-medium capitalize">
            {link.link_type}
          </p>
        </div>
        <div>
          <p className="text-gray-600">Access Level</p>
          <p className="font-medium capitalize">
            {link.access_level}
          </p>
        </div>
        <div>
          <p className="text-gray-600">Created</p>
          <p className="font-medium">
            {new Date(link.created_at).toLocaleDateString()}
          </p>
        </div>
        <div>
          <p className="text-gray-600">Status</p>
          <p
            className={`font-medium ${
              isActive ? "text-green-600" : "text-gray-600"
            }`}
          >
            {isActive ? "Active" : "Inactive"}
          </p>
        </div>
      </div>

      {link.expires_at && (
        <div className="mb-4 p-3 bg-yellow-50 border
                        border-yellow-200 rounded text-sm">
          <p className="text-yellow-900">
            <span className="font-bold">Expires:</span>{" "}
            {new Date(link.expires_at).toLocaleDateString()}
          </p>
        </div>
      )}

      {link.link_type === "group" && (
        <div className="mb-4 p-3 bg-blue-50 border
                        border-blue-200 rounded text-sm">
          <p className="text-blue-900">
            <span className="font-bold">Max team size:</span>{" "}
            {link.max_team_size || "Unlimited"}
          </p>
          <p className="text-blue-900">
            <span className="font-bold">Max groups:</span>{" "}
            {link.max_groups || "Unlimited"} (
            {Number(link.current_groups) || 0} created)
          </p>
        </div>
      )}

      {link.link_type === "coursedocs" && (
        <div className="mb-4 p-3 bg-purple-50 border
                        border-purple-200 rounded text-sm">
          <p className="text-purple-900">
            <span className="font-bold">Shared access:</span>{" "}
            All students join the same team and repository
            with read-only access.
          </p>
        </div>
      )}

      <button
        onClick={() => setExpanded(!expanded)}
        className="text-sm text-blue-600 hover:text-blue-700
                   font-medium"
      >
        {expanded ? "Hide" : "Show"} Analytics
      </button>

      {expanded && <LinkDetails linkId={link.link_id} />}
    </div>
  );
}
